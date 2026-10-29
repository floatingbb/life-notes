# 独立部署指南

请从空的新环境开始。不要将此源码连接到其他人的日记环境。

## 1. 创建自己的 CloudBase 环境

选择支持 PostgreSQL 的 CloudBase 环境，记下**新环境**的 ID 和地域。套餐、免费试用时长及资源点以你的控制台为准。

## 2. 建立数据库和私有图片桶

在新环境中执行 `cloudbase/migrations/20261001000000_family_diary.sql`，建立空表、索引和权限。该文件没有任何家庭数据。

在 pgstore 中建立名为 `our-days-photos` 的私有桶：

- Public / 公开访问：关闭。
- 文件大小上限：200000 字节。
- 允许 MIME：`image/jpeg`。

这是 PostgreSQL 环境的 pgstore，不是传统 COS 存储。若使用其他桶名，同时修改运行配置 `PHOTO_BUCKET`。不要开放匿名数据库或存储读取来绕过错误。

## 3. 配置自己的服务器变量

`.env.example` 是空白配置说明，不应上传真实 `.env` 文件到 GitHub。把以下变量配置在你自己的云函数运行环境中：

| 变量 | 内容 |
| --- | --- |
| `CLOUDBASE_ENV_ID` | 新建环境 ID，必填 |
| `CLOUDBASE_REGION` | 对应地域，例如 `ap-shanghai` |
| `PHOTO_BUCKET` | 自己的私有桶名，默认 `our-days-photos` |
| `CLOUDBASE_APIKEY` | 此新环境的服务端 API Key，必须能以服务端角色访问表和 pgstore |
| `SESSION_SECRET` | 自己生成的至少 32 字符随机会话密钥 |
| `BOOTSTRAP_TOKEN` | 自己生成的 64 位十六进制初始化令牌 |

会话密钥和初始化令牌应分别独立生成，例如运行两次：

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

不要将真实输出贴到 Issue、README、截图或 Actions 日志。API Key 只放服务端，留意其到期日。

## 4. 构建并手动部署

运行 README 中的安装、检查和构建命令。然后在你自己的环境：

1. 将 `dist/cloudfunctions/our-days-api/` 部署为 Node.js Event 云函数，入口为 `index.main`。使用支持 Node 20 或更高版本的运行时。
2. 设置上一步的服务器变量。函数时限应符合当前套餐；照片上传、数据库与存储请求可能需要较长处理时间。失败的永久删除会保留照片清理重试入口。
3. 将 `dist/public/` 的内容部署到新环境的静态托管根目录。
4. 为同一域名配置 `/api` 前缀到 `our-days-api`，保留完整路径、请求体和查询参数。根目录 `/` 提供静态网页。
5. 必须使用 HTTPS。`/api/health` 应返回 `status: online`，未登录的 `/api/access` 应显示尚未登录或需要初始化。

图片提交使用 `application/octet-stream` 包装 JSON，避免云函数文本请求体较小的限制。不要自行将这些提交强制转换为文本类型。

## 5. 初始化管理员

打开你自己的网站，例如 `https://your-site.example/#setup=YOUR_INITIALIZATION_TOKEN`，其中令牌必须是你自己设置的完整 64 位十六进制值。设置至少 12 位的管理员密码。只初始化一次。

初始化链接不是家人邀请链接，不要转发。初始化后，从管理员入口邀请自己的家人。每个新实例都必须重新创建自己的成员与链接。

## 6. 升级已有的自己的实例

更新网页与函数代码时，保留自己的数据库、图片桶和 `SESSION_SECRET`。不要重新执行空库初始化来覆盖已有数据。改变会话密钥会使会话和已加密保存的邀请链接无法继续使用。

云平台测试域名可能显示平台访问提示；自定义域名、备案、套餐限制及收费按平台当前规则处理。本仓库不会自动创建、付费或部署任何云资源。
