@echo off
@openssl version >nul 2>nul
IF %errorlevel% == 9009 (
    goto needInstall
    pause
)
IF %errorlevel% == 0 (
    goto spawn
    pause
)
:spawn
    echo 即将生成证书文件 请按提示输入
    echo 教程可查看readme.md文件
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout %cd%/assets/https/server.key -out %cd%/assets/https/server.crt
    echo 证书已在对应目录下生成 请进入assets/https目录下查看(server.crt和server.key)
    echo 如生成无误可在配置文件中开启https功能并重启服务端使其生效
    echo (此为自签证书 浏览器访问时会报不安全 但传输加密仍可运行)
    pause
    exit
:needInstall
    echo 未安装OpenSSL或环境变量未正确配置
    echo 在此下载:https://slproweb.com/products/Win32OpenSSL.html
    pause
    exit