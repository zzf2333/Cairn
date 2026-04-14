---
domain: auth
hooks: ["auth", "login", "登录", "认证", "JWT", "session", "token", "OAuth", "用户权限"]
updated: 2024-06
status: active
---

# auth

## current design

JWT + Refresh Token 轮换。认证校验内联在路由处理器中，未提取为中间件
（AUTH-COUPLING 已接受为技术债）。密码重置流程存在，但缺少邮箱验证。
2024-06 新增 Google OAuth 登录。

## trajectory

2022-12 基础 JWT，无刷新机制，单设备假设
2023-06 引入 Refresh Token 轮换，支持多设备
2024-01 识别认证耦合问题，正式接受为技术债（AUTH-COUPLING）
2024-06 新增 Google OAuth2 登录，当前状态

## rejected paths

- **基于 Session 的认证**：有状态 Session 与 Railway 水平扩展不兼容——需要粘性会话
  或 Redis Session 存储。
  重新评估时机：基础设施支持 Redis 作为 Session 后端
- **Auth0 / 第三方认证服务**：当前规模下成本不合理；对 2 人团队而言接入复杂度过高。
  重新评估时机：团队 > 4 人或出现合规要求
- **中间件提取**：对 2 人团队预估需 2 周；38 个以上受保护路由均需重构和回归测试；
  存在引入微妙认证绕过漏洞的风险。
  重新评估时机：团队 > 4 人且有专人负责迁移

## known pitfalls

- **AUTH-COUPLING（已接受技术债）**：认证校验内联在每个路由处理器中，未走中间件。
  修改认证流程需要逐一改动每条受保护路由。
  不要尝试将其"顺手提取为中间件"——这是已接受的技术债，有明确的重新评估条件
  （团队 > 4 人或 MAU > 10 万）
- **Refresh Token 竞态条件**：多标签页并发请求可能在 Token 轮换时触发竞态。
  旧 Token 保留 10 秒宽限期是有意为之，不要删除该宽限期
- **OAuth state 参数**：Google OAuth 流程未对 state 参数进行 CSRF 校验。
  不要将 OAuth 回调暴露给用户可控的重定向地址

## open questions

- 未来接入其他 OAuth 提供方（GitHub、Microsoft）时的 scope 策略
- 是否引入 RBAC，还是保持现有简单角色标志（user / admin）
