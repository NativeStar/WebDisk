# WebDisk
使用Node.js实现的简单网盘 支持文件分享 后台管理 媒体文件在线播放 多次登录失败限制

(自学开发瞎写的玩意)
## 启动与关闭
1.下载所有文件并解压

2.双击`Launcher.bat`

此时会检测设备是否安装Node.js 如未安装则进行提醒 
需要按照指引进行下载安装 或访问
[Node.js官网](https://nodejs.org/)
自行安装

首次启动会自动安装依赖 这需要一些时间

(开发时使用的Node.js版本为V18.15.0 其他版本无法保证不出问题)

关闭时请在命令行页面同时按下Ctrl+C或在未关闭命令功能的情况下输入`shutdown`并回车(详见[控制台命令](#tp_cmd))

<h2 id="tp_serverConfig">配置文件</h2>

首次启动会在根目录下生成配置文件 `config.json`并带有默认设置 

对其进行的直接修改需重启服务端才能生效
### 各配置项详情:

#### debug:
启用调试模式 在该模式下:
 
日志将输出额外调试信息

网页后台登录Token将锁定为预设值(重启服务器不会掉后台登录)

发送验证码邮件时会在日志中输出本次验证码

验证码邮件标题开头会多出字样:`"[开发模式:验证码邮件测试]"`

自动保存数据文件时间固定为10秒

>非必要不建议打开

*类型：`string` 默认:`false`*

#### storagePath:
用户文件存储目录 建议使用相对路径

*类型:`string` 默认:`"./_diskStorage/"`*

#### enabledWebBackground:

启用网页后台管理 如关闭将只能使用服务端命令行操作

*类型:`boolean` 默认:`true`*

#### enableHTTPS:
开启Https支持 需要自行准备证书
相关请查看
[启用Https](#tp_https)

*类型:`boolean` 默认:`false`*
### maxLogArrayLength:
设定网页后台实时日志最长缓存大小 超出此值日志将清空

过长会占用更多内存

>这是修改网页后端显示的日志限制 不是保存在本地的日志文件长度限制(`.log`文件)

*类型:`number` 默认:`256`*
#### portForHTTPS:
Https使用的端口 

如果你能解决证书验证问题建议将此值改为`443`(https正常情况下默认端口 使浏览器可直接访问https) 

否则建议设为除`80`和`443`外的其他值以避免访问时浏览器直接使用Https

在证书无法通过验证(如使用自签证书)时使用Https浏览器会警告证书无效 ~~可能把进网站的人直接吓跑~~

*类型:`number` 默认:`1524`*
#### registerVerify:
注册账户时需要进行邮箱验证 如关闭则只需要输入邮箱(无论是否真实有效 前后端只进行格式校验)即可注册账户

开启该功能前需要先正确配置发件信息否则无法注册 详见
[发件配置](#tp_mailer)

*类型:`boolean` 默认:`false`*

#### defaultNewUserStorage:
设置新注册用户分配的存储空间大小 单位:MB

修改该配置不会影响之前注册账户的存储空间

*类型:`number` 默认:`128`*

#### randomBackgroundPort:
随机化网页后台使用的端口 如关闭则使用设定的固定端口

(没啥卵用的功能 一个端口扫描解决)

*类型:`boolean` 默认:`false`*

#### backgroundPort:
固定的网页后台端口 在未开启随机端口时使用

*类型:`number` 默认:`8650`*

#### backgroundLoginGUI:

登录页面的用户UI 如关闭登录网页后台时将不会有输入密码界面 需要将密码带入地址中登录

方法为:网站域名/login.admin?key=密码

如密码为`123456`且服务端在本地部署时登录后台要输入:http://127.0.0.1:8650/login.admin?key=123456

(没什么鸟用 还麻烦)

*类型:`boolean` 默认:`true`*

#### backgroundRandomKey:
每次启动时随机网页后台的登录密码(64位小写英文+数字混合)

随机的密码会在控制台上显示(可复制后使用`clear`命令清除以免被他人知道 详见[控制台命令](#tp_cmd))

*类型:`boolean` 默认:`false`*

#### backgroundLoginKey:
在随机后台密码未开启时使用的固定密码 建议使用大小写字母和数字

>强烈建议使用前修改默认密码以防被他人直接登录后台  

*类型:`string` 默认:`adminLogin`*

#### onlyLocalhostBackground:
开启后只允许本机访问网页后台 如果没有远程管理需求~~又不想本地敲命令~~开启该选项可提高安全性

*类型:`boolean` 默认:`false`*

#### autoSaveTimer:
自动保存数据的间隔 减少服务端被异常停止时本次运行期间更改的数据丢失(*说人话就是异常停服没法正常收尾时止损*)

按需调整 单位:秒

*类型:`number` 默认:`1800000`*

#### enableShare:
允许用户使用文件分享功能 关闭后所有用户无法进行文件分享和获取分享

*类型:`boolean` 默认:`true`*

#### enableRegister:
允许新用户注册 关闭后将无法注册新账户

不影响网页后台和控制台命令注册

*类型:`boolean` 默认:`true`*

#### enabledStreamMedia:
允许用户在个人存储空间和公开文件区对媒体文件点击右侧"播放"按钮对该文件进行在线播放

>该功能很消耗服务器带宽(特别是播放视频) 需酌情调整

*类型:`boolean` 默认:`true`*

#### enableNickName:
允许用户设置账户昵称 它会在用户网盘主页右上角和分享文件的分享者处显示

新注册账户的默认昵称即为用户名

*类型:`boolean` 默认:`true`*
#### changeNicknameExamine:
开启后 用户在修改昵称时都需要后台手动审核 否则昵称修改直接生效

除非该用户在[用户数据](#tp_userData)中的属性`permission`被设置为`"admin"`(修改该属性需要手动打开并修改用户列表文件`regUsers.json`)

>按需调整该设置 特别是在公开服务且[屏蔽词列表](#tp_sensitiveWords)未完善的情况下

*类型:`boolean` 默认:`false`*
#### enableResetPassword:
允许用户通过登录页"忘记密码"功能进行密码重置

使用该功能前需先正确进行[发件配置](#tp_mailer)

*默认:`false`*

#### deletedFilesBackup:
是否备份用户删除其存储空间内的文件

如果开启则用户每次删除文件时都会将目标文件其移动到根目录"_deletedFiles/用户名"文件夹下

遇到重名文件时会在文件名末尾加上随机6位小写字母和数字

*类型:`boolean` 默认:`false`*
#### enableBanipTips:
修改当被封禁的IP访问时是否显示提示文本 如关闭则直接拒绝请求

*类型:`boolean` 默认:`true`*

#### banipTipsText:
被封禁IP访问时提示的文本内容 如果`enableBanipTips`开启时被封禁IP访问网站将返回该文本

*类型:`string` 默认:`"IP banned"`*

#### autoProvisionalBanip:
开启后会对发起违规请求达到3次的IP进行临时封禁

网页后台登录失败达到3次的IP也将被临时封禁(前后台临时封禁不互通)

封禁时间可自行配置

会触发临时封禁的行为详见[杂项](#tp_chaos)

*类型:`boolean` 默认:`false`*
#### provisionalBanipTime:
临时封禁IP的时长 单位:秒

*类型:`number` 默认:`300000`*

#### limitRegisterEveryday:
是否限制单IP每日注册的账户数量 限制量可配置

该限制会在每天0:01左右刷新

*类型:`boolean` 默认:`false`*
#### maxEverydayRigister:
单IP每日注册账户的最大数量 在`limitRegisterEveryday`开启时生效

*类型:`number` 默认:`16`*

#### loginFailedLimitTime:
账户登录失败达到5次时阻止该IP再次尝试登录的时间 单位:秒

登录成功或超过30分钟未再次尝试登录会重置

超过该时间后会重新获得5次登录机会

*类型:`number` 默认:`300000`*
#### mailerConfig:
发送验证码邮件的邮箱配置 如不使用相关功能可不填

详见[发件配置](#tp_mailer)

*类型:`object` 默认:`null`*

<h2 id="tp_mailer">发件配置</h2> 

你需要准备一个邮箱并正确配置才能进行验证码发送操作

>仅测试过网易邮箱"IMAP/SMTP"服务 其他请自行测试
### email:
用于发送邮件的邮箱账号 如`1000000000@163.com`

*类型:`string`*
### pass:
邮箱授权码 获取方式因邮箱而异

通常为登录对应邮箱网页版后进入设置页获取

获取方式可参考以下网站:

QQ邮箱:https://www.kancloud.cn/z771661581/aizc1001/2212365

网易邮箱:https://consumer.huawei.com/cn/support/content/zh-cn15872099/

其他邮箱自行搜索

*类型:`string`*
### host:
使用的邮箱服务器地址 如网易的"smtp.163.com"

可参考:https://blog.csdn.net/Sakitaf/article/details/104486593/

*类型:`string`*

### port:
使用的邮箱服务器端口

可参考:https://blog.csdn.net/Sakitaf/article/details/104486593/
(同上)

*类型:`number`*

<h2 id="tp_cmd">控制台命令</h2>

*~~玩Minecraft玩的(误~~*

服务端运行时可以在命令行界面输入命令进行操作 功能强于网页后台

部分命令执行时不传入任何参数会出现更详细的使用方法

### 命令列表

#### help:
获取帮助 无其他参数时列出所有命令及其功能简介

help {其他命令}:

查看对应命令的用法

#### lock:
锁定控制台 无法执行除`unlock`外其他命令和执行正常关闭(不防直接点击关闭窗口按钮或任务管理器)

锁定后需要进行解锁 可设置密码

lock :

锁定控制台且解锁无需密码

lock {密码}:
锁定控制台且解锁需要密码 

#### unlock:
解锁控制台 恢复功能

unlock :

无密码时解锁控制台

unlock {密码}:

有密码时解锁控制台
#### clear:
清空控制台信息 相当于命令提示符的`cls`命令

服务端启动时控制台会打印后台登录密码 如有需要可在记下密码后输入此命令清空控制台防止他人查看

该命令无参数
#### shutdown:
关闭服务器

shutdown {强制关闭所有连接:boolean (可选 默认:true)}

关闭服务器 如果启用强制关闭连接则不会等待已创建的连接自行关闭 可更快关服(基本没用)

如果参数留空或设为`true`则跟Ctrl+C没区别

#### account:
管理账户

account list:

列出所有注册的账户

account create {用户名} {密码} {邮箱}:

创建一个账户 不能与现有账户重复用户名

>使用控制台或网页后台创建账户时不会校验邮箱格式合规性及用户名屏蔽词

account remove {用户名} {删除存储空间:boolean (可选 默认false)}:

删除一个账户及其分享 如果启用"删除存储空间"则会在删除时清空其存储盘内的文件

account getConfig {用户名}:

获取该账户的配置数据 各项含义详见[用户数据](#tp_userData)

account setConfig {用户名} {配置项} {值}:

修改该账户对应配置项的值 各项含义详见[用户数据](#tp_userData)

account logout {用户名}:

强制登出目标账户(重置Token)

account deleteDisabledAccount:

删除所有[用户数据](#tp_userData)中`enabled`被设为`false`的账户 包括其存储空间文件、密码等

#### config:
修改服务端配置 在这更改的配置大多无需重启服务端即可生效(部分配置可能仍需重启才能完全生效)

config get:

查看服务端当前配置

config set {配置项} {值}：

更改目标配置项的值 各项配置的类型及作用详见[配置文件](#tp_serverConfig)

config set mailerConfig {发件邮箱} {授权码} {地址} {端口}:

设置邮箱发件功能 各项配置详见[发件配置](#tp_mailer)

#### getStatistics:

获取服务端本次启动的统计信息 注册、登录、下载文件等次数

该命令无参数

#### share:
管理所有用户的文件分享

share list {账户 (可选)}:

列出分享 如未传入用户名则列出所有用户的分享

如传入用户名则列出目标账户的文件分享

share removeAccount {用户名}:

移除目标账户的所有分享

share removeId {分享ID}:

移除指定的文件分享 需要输入分享ID

#### nickname:
管理用户提交的昵称更改请求

每个用户最多同时有一个请求 请求未被处理前无法再次更改昵称

请求同意后会立即更改其昵称 拒绝后用户不会收到任何提醒 同时可提交新请求

nickname list:

列出所有更改昵称请求

nickname agree {用户名}:

同意目标账户的修改昵称请求

nickname reject {用户名}:

拒绝目标账户的修改昵称请求

#### refreshPublicFile:
刷新公开文件列表 详见[公开文件](#tp_chaos)

该命令无参数
#### banip:
管理封禁的IP地址

>此为永久封禁 不会与临时封禁一样由软件自行操作

banip list:

列出所有被封禁的IP列表

banip add {IP地址}:

封禁目标IP 阻止其访问服务器

banip remove {IP地址}:

解封目标IP

<h2 id="tp_https">HTTPS配置</h2>

开启Https后服务器启动将读取`assets/https/`目录下的`server.crt`和`server.key`文件

如果要使用自己的证书文件 请按如上方式进行命名(`server.后缀`)

#### 生成自签证书
>你需要安装OpenSSL并正确配置环境变量才能生成自签证书 OpenSSL下载地址:https://slproweb.com/products/Win32OpenSSL.html

>环境变量配置教程:http://www.taodudu.cc/news/show-3572176.html?action=onClick

执行目录下`CreateHttpsCert.bat`文件将检测OpenSSL可用性并开始生成证书 期间需要你根据提示输入内容 输入完成后请回车

输入教程(提示内容:输入教程):

Country Name:国家名缩写 如`CN`

State or Province Name:省名 拼音 如`shandong`

Locality Name:市名 拼音 如`qingdao`

Organization Name:公司或组织名 英文 一般瞎写 如`StarPiece`

Organizational Unit Name:机构名 英文 一样瞎写

Common Name:名称 英文 瞎写 如`leader`

Email Address:邮箱地址 可以瞎写但格式要对 怕出问题就写真实邮箱罢

邮箱输入完成后文件将生成在指定目录中 此时修改配置文件中`enableHTTPS`为`true`即可启用Https

>自签证书无法通过浏览器验证 会在进入网站时警告证书无效 但不影响进行传输加密


## 网页后台
如果开启了https后台将强制使用https 并且http支持将会关闭

后台使用的端口可在配置文件中修改 或开启随机端口(将在启动时将使用的端口号打印在控制台)

登录密码类似 可配置为固定或随机 开服时会在控制台打印登录密码

可以通过网页后台远程进行简单操作

## 其他
### 用户列表及配置
所有已注册用户及其配置均存储于`/_server_data/regUsers.json`文件内
<!-- #### 用户配置内容 -->
<h4 id="tp_userData">用户配置内容</h4>

每个对象代表一个账户的数据 键名即其用户名

password:登录密码 类型:`string`

permission:如果该项设置为`admin`则更改昵称可以绕过审核(也就这一个功能) 类型:`string`

storage:分配的存储空间大小 单位:MB 类型:`number`

nickName:用户昵称 类型:`string`

email:绑定邮箱 类型:`string`

uaDetectEnable:是否开启UA验证 类型:`boolean`

ua:验证用UA 类型:`string`

enableShare:是否允许该账户分享文件 类型:`boolean`

onUserAgentDetectFailed:当登录时UA验证失败的提示内容 设置为`ua`则提示UA验证失败 为`password`则提示为密码错误 类型:`string`

enabled:账户是否启用 如设为`false`则账户会被停用且执行命令`account deleteDisabledAccount`时会被删除 类型:`boolean`

<h4 id="tp_sensitiveWords">屏蔽词配置</h4>

屏蔽词列表文件位于`/assets/sensitiveWords.json` 以数组格式存储

将需要屏蔽的字词追加至数组中即可

在检测时会自动去掉大多数标点符号防止被简单绕过

如列表被设置为`["dev","admin"]`则文件`dev.txt`和`admi=n.zip`将无法分享 关闭审核时修改昵称同理

<h4 id="tp_chaos">杂项</h4>
每日单个账户找回密码最多可发送5次验证码 发送次数将在每日凌晨0:00-0:01间刷新

当某个IP发起异常操作达到3次后该IP地址会被临时封禁5分钟(可配置是否启用该功能及封禁时间、被封禁时的提示词)
>异常操作如:异常参数的请求(如空参数 无效参数 触发XSS过滤等) 尝试绕过前端验证发起请求(如绕过可用空间限制等)

可将文件放入根目录下`/_publicFiles/`文件夹将其公开分享或使用网页后台上传

如果是直接操作服务器文件修改公开文件则需要输入命令`refreshPublicFile`或在网页后台"共享管理"选项卡点击"重载共享文件"