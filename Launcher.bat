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
echo δ֪����:%errorlevel%
pause
exit
:needInstall
    echo δ�ҵ�Nodejs �Ƿ�װ
    echo ����i��װ n�˳� r��������(�������Ѱ�װ������ʾ����Ϣ)
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
    echo ����Nodejsʧ�� �Ƿ�����
    echo ����r���� n�˳�
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
    echo ��������Nodejs18.16.1
    echo ������ʧ�������н���������ذ�װ:https://nodejs.org
    cd %TEMP%
    curl -o "nodeInstall_wds.msi" --ssl-no-revoke "https://nodejs.org/dist/v18.16.1/node-v18.16.1-x64.msi"
    IF %errorlevel% NEQ 0 (
        goto installError
        pause
        exit
    )
    echo ������� ���ֶ���װ
    %TEMP%\nodeInstall_wds.msi
    del %TEMP%\nodeInstall_wds.msi
    echo ��ɾ����װ�ļ�
    pause
    exit