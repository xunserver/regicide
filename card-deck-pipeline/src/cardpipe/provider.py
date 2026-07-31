from __future__ import annotations

import base64
import json
import mimetypes
import secrets
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from .config import ProviderConfig
from .models import GeneratedImage


class ProviderError(RuntimeError):
    pass


class OpenAICompatibleProvider:
    """Small dependency-free adapter for OpenAI-compatible image APIs."""

    def __init__(self, config: ProviderConfig):
        self.config = config

    def _url(self, path: str) -> str:
        base = self.config.base_url
        if not base.endswith("/v1"):
            base += "/v1"
        return base + "/" + path.lstrip("/")

    def _request(
        self,
        path: str,
        body: bytes,
        content_type: str,
        retries: int = 3,
    ) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": content_type,
            "Accept": "application/json",
            "User-Agent": "card-deck-pipeline/0.1",
        }
        last_error: Exception | None = None
        for retry in range(retries):
            request = urllib.request.Request(
                self._url(path), data=body, headers=headers, method="POST"
            )
            try:
                with urllib.request.urlopen(
                    request, timeout=self.config.timeout_seconds
                ) as response:
                    return json.loads(response.read())
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", "replace")[:2000]
                last_error = ProviderError(f"HTTP {exc.code}: {detail}")
                if exc.code not in (408, 409, 429) and exc.code < 500:
                    raise last_error from exc
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
                last_error = exc
            if retry + 1 < retries:
                time.sleep(min(2**retry, 8))
        raise ProviderError(f"Provider request failed: {last_error}")

    def generate(
        self, prompt: str, reference_paths: tuple[Path, ...] = ()
    ) -> GeneratedImage:
        usable_refs = tuple(path for path in reference_paths if path.exists())
        if usable_refs and self.config.supports_edits:
            response = self._generate_with_references(prompt, usable_refs)
        else:
            response = self._generate_json(prompt)
        return self._decode_image_response(response)

    def _generate_json(self, prompt: str) -> dict[str, Any]:
        payload = {
            "model": self.config.image_model,
            "prompt": prompt,
            "n": 1,
            "size": self.config.size,
            "quality": self.config.quality,
            "output_format": self.config.output_format,
            **self.config.extra_body,
        }
        return self._request(
            "images/generations",
            json.dumps(payload).encode(),
            "application/json",
        )

    def _generate_with_references(
        self, prompt: str, paths: tuple[Path, ...]
    ) -> dict[str, Any]:
        fields = {
            "model": self.config.image_model,
            "prompt": prompt,
            "n": "1",
            "size": self.config.size,
            "quality": self.config.quality,
            "output_format": self.config.output_format,
            **{key: str(value) for key, value in self.config.extra_body.items()},
        }
        body, boundary = encode_multipart(fields, paths)
        return self._request(
            "images/edits", body, f"multipart/form-data; boundary={boundary}"
        )

    def _decode_image_response(self, response: dict[str, Any]) -> GeneratedImage:
        try:
            item = response["data"][0]
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError(
                f"Unexpected image response: {json.dumps(response)[:1000]}"
            ) from exc
        extension = self.config.output_format.lower().replace("jpeg", "jpg")
        if item.get("b64_json"):
            try:
                data = base64.b64decode(item["b64_json"], validate=True)
            except (ValueError, TypeError) as exc:
                raise ProviderError("Provider returned invalid base64 image data") from exc
        elif item.get("url"):
            request = urllib.request.Request(
                item["url"], headers={"User-Agent": "card-deck-pipeline/0.1"}
            )
            try:
                with urllib.request.urlopen(
                    request, timeout=self.config.timeout_seconds
                ) as downloaded:
                    data = downloaded.read()
                    content_type = downloaded.headers.get_content_type()
                    guessed = mimetypes.guess_extension(content_type)
                    if guessed:
                        extension = guessed.lstrip(".").replace("jpeg", "jpg")
            except (urllib.error.URLError, TimeoutError) as exc:
                raise ProviderError(f"Could not download generated image: {exc}") from exc
        else:
            raise ProviderError("Provider returned neither b64_json nor url")
        return GeneratedImage(
            data=data,
            extension=extension,
            revised_prompt=item.get("revised_prompt"),
            provider_metadata={
                key: value
                for key, value in response.items()
                if key != "data"
            },
        )

    def review_image(
        self, image_path: Path, prompt: str, rubric: str
    ) -> dict[str, Any]:
        if not self.config.qa_model:
            raise ProviderError("No QA model configured")
        mime = mimetypes.guess_type(image_path)[0] or "image/png"
        encoded = base64.b64encode(image_path.read_bytes()).decode()
        instruction = (
            "You are a strict art director for a collectible card deck. "
            "Review the image against the production prompt and rubric. Return JSON only: "
            '{"passed":boolean,"score":number from 0 to 1,"issues":[string],'
            '"revision_instruction":"one precise edit instruction or empty string"}. '
            "Do not reject purely for subjective taste.\n\n"
            f"PRODUCTION PROMPT:\n{prompt}\n\nRUBRIC:\n{rubric}"
        )
        payload = {
            "model": self.config.qa_model,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": instruction},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime};base64,{encoded}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
        }
        response = self._request(
            "chat/completions", json.dumps(payload).encode(), "application/json"
        )
        try:
            content = response["choices"][0]["message"]["content"]
            if isinstance(content, list):
                content = "".join(
                    part.get("text", "") for part in content if isinstance(part, dict)
                )
            return json.loads(content)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
            raise ProviderError(
                f"Unexpected QA response: {json.dumps(response)[:1000]}"
            ) from exc


def encode_multipart(
    fields: dict[str, str], image_paths: tuple[Path, ...]
) -> tuple[bytes, str]:
    boundary = "----cardpipe-" + secrets.token_hex(16)
    chunks: list[bytes] = []

    def add(value: str) -> None:
        chunks.append(value.encode())

    for name, value in fields.items():
        add(f"--{boundary}\r\n")
        add(f'Content-Disposition: form-data; name="{name}"\r\n\r\n')
        add(f"{value}\r\n")
    for image_path in image_paths:
        mime = mimetypes.guess_type(image_path)[0] or "application/octet-stream"
        add(f"--{boundary}\r\n")
        add(
            f'Content-Disposition: form-data; name="image"; '
            f'filename="{image_path.name}"\r\n'
        )
        add(f"Content-Type: {mime}\r\n\r\n")
        chunks.append(image_path.read_bytes())
        add("\r\n")
    add(f"--{boundary}--\r\n")
    return b"".join(chunks), boundary
