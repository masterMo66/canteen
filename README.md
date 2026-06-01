# 今日餐谱

单页餐谱网站，按上海时区自动展示当天菜单。菜单数据来自：

- `黄山大厦  总行餐厅  1楼周菜单 6.1-6.5.xls`
- `蜀王餐厅一周菜单6.1-6.5.xlsx`

## Development

```bash
npm install
npm run dev
```

## Checks

```bash
npm run lint
npm run build
```

## Deployment

`main` 分支推送后由 GitHub Actions 部署到 GitHub Pages。自定义域名配置在 `public/CNAME`：

```text
canteen.moqi.chat
```
