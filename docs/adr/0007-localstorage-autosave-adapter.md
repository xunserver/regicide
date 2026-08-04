# Store the autosave in localStorage

H5 应用用 `localStorage` 实现单槽自动存档，因为完整 `GameState` 很小且不需要多对象事务。适配器保存带独立存档版本的 JSON envelope，读取后把其中的 core 快照交给 `parseGameState` 校验；`game-application` 只依赖存档端口，不直接导入 `window` 或 Web Storage API。
