# Runtime game assets

这里存放必须保持文件名、或需要通过资源清单在运行时加载的游戏资源。

```text
game-assets/
├── manifest.json
├── cards/
├── enemies/
├── backgrounds/
├── effects/
├── audio/
│   ├── music/
│   └── sfx/
└── fonts/
```

由 TypeScript/CSS 静态引用的资源应放在相应 package 的 `src/assets`，交给 Vite 处理和哈希。
