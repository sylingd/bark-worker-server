# Bark Worker Server

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

Bark Worker Server 是一个 [Bark-Server](https://github.com/Finb/bark-server) 在 各边缘函数环境上的实现。

支持以下环境：
* Cloudflare Workers
* EdgeOne Edge Functions
* 阿里云 ESA

## 安装使用

### EdgeOne

* 待编写

<!-- [![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/pages/new?repository-url=https%3A%2F%2Fgithub.com%2Fsylingd%2Fbark-worker-server&env=DB_NAME,ALLOW_NEW_DEVICE,ALLOW_QUERY_NUMS) -->

### 阿里云 ESA

* 待编写

### Cloudflare Worker

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fsylingd%2Fbark-worker-server)

* 待编写

## 已知问题

* 暂不支持批量推送。
* 因 KV 写入延迟，可能导致以下问题：
  * 设备注册后，过一小段时间（几秒钟）才能开始推送。
  * 重置或还原 Key，或短时间有大量新设备注册时，有概率会丢失注册数据，重新操作可解决。

## 其他

部分代码修改自 [cwxiaos/bark-worker](https://github.com/cwxiaos/bark-worker)，遵循原许可协议，以 GPLv3 协议发布。
