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
    echo ��������֤���ļ� �밴��ʾ����
    echo �̳̿ɲ鿴readme.md�ļ�
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout %cd%/assets/https/server.key -out %cd%/assets/https/server.crt
    echo ֤�����ڶ�ӦĿ¼������ �����assets/httpsĿ¼�²鿴(server.crt��server.key)
    echo ������������������ļ��п���https���ܲ����������ʹ����Ч
    echo (��Ϊ��ǩ֤�� ���������ʱ�ᱨ����ȫ ����������Կ�����)
    pause
    exit
:needInstall
    echo δ��װOpenSSL�򻷾�����δ��ȷ����
    echo �ڴ�����:https://slproweb.com/products/Win32OpenSSL.html
    pause
    exit