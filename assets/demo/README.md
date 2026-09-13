# README 动态演示素材

三个 GIF 使用 `demo/showcase.html` 加载当前实际编译脚本录制，1200 × 820，无 AI 返回模拟，也没有对词卡内容进行后期伪造。橙色圆圈只用于指示真实鼠标位置。

- `hover-reading.gif`：连续悬浮「ものの」「金融政策」「データセンター」。
- `example-explorer.gif`：展开语法资料，在卡内原句继续查询「個人消費」，关闭子卡返回。
- `collect-review.gif`：把「踏まえる」收录到两个分类，进入资料库，用保存的原句挖空复习、揭晓并评分。

录制时验证查询对象、分类数量、资料库条目数量和复习答案状态；运行产生的浏览器错误必须为空。帧数量、时长、体积和浏览器版本见 `recording-info.json`。GIF 循环播放并保留操作停顿；README 同时提供静态截图入口。

重新录制（开发用途）：

```sh
node scripts/record-showcase.mjs
python -m pip install --target .test-output/gif-deps Pillow
python scripts/encode-showcase.py
```

PNG 原始帧保存在 Git 忽略的 `.test-output/showcase/` 中，不需要上传。实际发布需同时上传根目录 `README.md` 和本目录三个 GIF，保持相对路径；仓库已有的静态 PNG 无需重复上传。
