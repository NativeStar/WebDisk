@echo off
title WebDisk launcher batch
@node -v >nul 2>nul
IF %errorlevel% == 9009 (
    goto needInstall
    pause
)
IF %errorlevel% == 0 (
    goto launch
    pause
)
echo 未知错误:%errorlevel%
pause
exit
:needInstall
    echo 未找到Nodejs 是否安装
    echo 输入i安装 n退出 r尝试运行(适用于已安装但仍提示此消息)
    set /p install=
    IF "%install%" EQU "n" (
        exit
    )
    IF "%install%" EQU "r" (
        goto launch
        pause
    )
    IF "%install%" EQU "i" (
        goto installNodejs
        pause
        exit
    )ELSE (
        goto needInstall
        pause
        exit
    )
:launch
    title Initializing...
    node launch.js
    pause
    exit
:installError
    title Failed
    echo 下载Nodejs失败 是否重试
    echo 输入r重试 n退出
    set /p retry=
    IF "%retry%" EQU "r" (
        goto installNodejs
        pause
        exit
    )
    IF "%retry%" EQU "n" (
        exit
    )ELSE (
        goto installError
        pause
        exit
    )

:installNodejs
    title Downloading
    echo 正在下载Nodejs18.16.1
    echo 如下载失败请自行进入官网下载安装:https://nodejs.org
    cd %TEMP%
    curl -o "nodeInstall_wds.msi" --ssl-no-revoke "https://nodejs.org/dist/v18.16.1/node-v18.16.1-x64.msi"
    IF %errorlevel% NEQ 0 (
        goto installError
        pause
        exit
    )
    echo 下载完成 请手动安装
    %TEMP%\nodeInstall_wds.msi
    del %TEMP%\nodeInstall_wds.msi
    echo 已删除安装文件
    pause
    exit