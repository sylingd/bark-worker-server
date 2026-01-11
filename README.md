# Bark Worker Server

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

Bark Worker Server 是一个 [Bark-Server](https://github.com/Finb/bark-server) 在 各边缘函数环境上的实现。

## 安装使用

### EdgeOne

[![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/pages/new?repository-url=https%3A%2F%2Fgithub.com%2Fsylingd%2Fbark-worker-server&env=DB_NAME,ALLOW_NEW_DEVICE,ALLOW_QUERY_NUMS)

[部署教程](https://github.com/sylingd/bark-worker-server/discussions/2)

### 阿里云 ESA

[部署教程](https://github.com/sylingd/bark-worker-server/discussions/3)

### Cloudflare Worker

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fsylingd%2Fbark-worker-server)

[部署教程](https://github.com/sylingd/bark-worker-server/discussions/4)

## 已知问题

* 因平台限制，批量推送功能存在最大上限。例如 Cloudflare Workers 每次最多推送 32 个设备。
* 因 KV 写入延迟，设备注册后，过一小段时间（几秒钟）才能开始推送。
* 设备计数并不准确，仅供测试数据库使用，请勿依赖此数据。

## 配置项

* `DB_NAME` KV 数据库名称。默认在 Cloudflare Workers、EdgeOne 下为 `BARK_KV`，ESA 下为 `bark`
* `ALLOW_NEW_DEVICE` 是否允许新设备注册，默认为 `true`
* `ALLOW_QUERY_NUMS` 是否允许查询设备数量，默认为 `true`
* `MAX_BATCH_PUSH_COUNT` 批量推送最大数量，默认不限制
* `BASIC_AUTH` 是否启用 HTTP Basic Auth，默认不启用
* `ROOT_PATH` 部署路径，默认为 `/`

## 其他

部分代码修改自 [cwxiaos/bark-worker](https://github.com/cwxiaos/bark-worker)，遵循原许可协议，以 GPLv3 协议发布。
