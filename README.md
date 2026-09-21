# 今日餐谱

按上海时区展示黄山大厦一楼、蜀王二楼和三楼菜单。菜单周期及来源校验值见 `src/menuSources.json`。网站：https://canteen.moqi.chat

## 开发与检查

```bash
npm ci
npm run dev
npm run lint
npm run build
python -m unittest discover -s scripts -p "test_*.py"
```

## 从微信本地附件更新

首次安装读取依赖（只读 Excel，不修改原文件）：

```bash
python -m pip install --target .local-python -r scripts/requirements.txt
```

传入微信账号的 `msg/file` 目录，不包含月份：

```bash
python scripts/import_menus.py --source-root "<微信账号目录>/msg/file" --check
python scripts/import_menus.py --source-root "<微信账号目录>/msg/file"
```

脚本扫描 `YYYY-MM` 子目录，匹配黄山大厦一楼和蜀王周菜单，只使用已到开始日期的最新周期。根据工作表实际日期和星期映射菜品，包括周末调休；外卖按自己的日期范围导入。新周期的两份文件到齐且供餐日期一致才更新，缺文件或解析异常会报错并保留原数据。原始工作簿和个人微信目录不提交到仓库。

输出为 `src/menuData.ts` 和 `src/menuSources.json`。相同输入重复运行不会产生变化。模板出现新工作表或日期冲突时需核对原表并调整解析器，不能凭空补菜单。

## 定期更新与发布

通过本地 Codex 当前任务的定时检查，每天北京时间 08:00、09:00、10:00、11:00 检查附件，覆盖周一早上、周末调休和节后首个工作日。无变化不提交；有变化则校验、构建并推送 `main`，由 `.github/workflows/deploy.yml` 发布 GitHub Pages。

定时检查依赖电脑开机、Codex 运行，以及微信已将附件下载到本地。它不能读取尚未下载的群附件。法定节假日安排用于判断缺失菜单是否需要提醒，实际供餐日期始终以菜单为准，不能把普通周一到周五规则套到调休周。

发布前先检查工作区与远程分支，避免提交其他未完成工作；运行导入、日期校验、lint 和 build，通过后只提交相关文件并推送，最后检查对应提交的 Pages 工作流和线上菜单。定时任务本身保存于本机 Codex，不属于 GitHub Actions；GitHub 无法直接访问本地微信文件。
