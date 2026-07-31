from __future__ import annotations

from pathlib import Path
from typing import Any

from PIL import Image, ImageStat, UnidentifiedImageError

from .models import ReviewResult
from .provider import OpenAICompatibleProvider, ProviderError


class Reviewer:
    def __init__(
        self,
        expected_size: str,
        provider: OpenAICompatibleProvider | None = None,
        rubric: str = "",
    ):
        self.expected_size = tuple(int(part) for part in expected_size.split("x"))
        self.provider = provider
        self.rubric = rubric

    def review(self, image_path: Path, prompt: str) -> ReviewResult:
        deterministic = self._deterministic_review(image_path)
        if not deterministic.passed:
            return deterministic
        if self.provider is None or not self.provider.config.qa_model:
            return deterministic
        try:
            result = self.provider.review_image(image_path, prompt, self.rubric)
        except ProviderError as exc:
            return ReviewResult(
                passed=True,
                score=deterministic.score,
                issues=(f"Semantic QA unavailable: {exc}",),
                reviewer="deterministic_qa_fallback",
            )
        score = max(0.0, min(1.0, float(result.get("score", 0))))
        passed = bool(result.get("passed", False)) and score >= 0.72
        issues = tuple(str(item) for item in result.get("issues", []))
        instruction = str(result.get("revision_instruction", "")).strip()
        if not passed and not instruction:
            instruction = "Correct the listed visual consistency issues: " + "; ".join(issues)
        return ReviewResult(
            passed=passed,
            score=score,
            issues=issues,
            revision_instruction=instruction,
            reviewer=f"vision:{self.provider.config.qa_model}",
            raw=result,
        )

    def _deterministic_review(self, image_path: Path) -> ReviewResult:
        issues: list[str] = []
        try:
            with Image.open(image_path) as image:
                image.verify()
            with Image.open(image_path) as image:
                actual = image.size
                image = image.convert("RGB")
                stats: Any = ImageStat.Stat(image.resize((64, 64)))
                contrast = sum(stats.stddev) / len(stats.stddev)
                extrema = image.getextrema()
        except (UnidentifiedImageError, OSError) as exc:
            return ReviewResult(
                passed=False,
                score=0,
                issues=(f"Unreadable image: {exc}",),
                revision_instruction="Regenerate a valid image file.",
            )
        if actual != self.expected_size:
            issues.append(
                f"Wrong dimensions: expected {self.expected_size}, received {actual}"
            )
        if contrast < 5:
            issues.append("Image is nearly blank or has extremely low contrast")
        if all(low == high for low, high in extrema):
            issues.append("Image contains no meaningful pixel variation")
        return ReviewResult(
            passed=not issues,
            score=1.0 if not issues else 0.2,
            issues=tuple(issues),
            revision_instruction=(
                "Regenerate at the required dimensions with a complete, non-blank composition."
                if issues
                else ""
            ),
        )
