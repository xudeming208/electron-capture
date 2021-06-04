<div align="center">
	<img width="100" src="https://github.com/xudeming208/electron-capture/blob/master/static/icons/logo.png?raw=true" alt="capture logo">
	<p>截图工具</p>
	<p align="center">
	  <a href="https://travis-ci.org/xudeming208/electron-capture"><img src="https://travis-ci.org/xudeming208/electron-capture.svg?branch=master" alt="Travis Status"></a>
	  <a href="https://github.com/xudeming208/electron-capture/graphs/contributors"><img src="https://img.shields.io/github/contributors/xudeming208/electron-capture.svg" alt="Contributors"></a>
	  <a href="javascript:;"><img src="https://img.shields.io/github/license/xudeming208/electron-capture.svg" alt="License"></a>
	</p>
</div>

## 介绍

利用electron开发的桌面截图工具，支持Windows、Mac、Linux，支持双屏幕

## 软件截图

![Capture-ui](https://github.com/xudeming208/electron-capture/blob/master/static/ui.png?raw=true)

## 示例

![Capture-demo](https://github.com/xudeming208/electron-capture/blob/master/static/demo.png?raw=true)

## 用法

```javascript
1. npm i
2. npm run build:all
3. 打包完成后，进入build文件夹中，将软件文件安装即可使用
	- Windows：找到exe文件
	- Mac：找到dmg文件
	- Linux选择以下任意一种文件使用即可：
		- deb：需要安装才能执行，可卸载（右键应用，点击“显示细节”，点击应用进入，点击“移除”即可）
		- AppImage：不需要安装，可直接执行。当你把AppImage文件删除，整个软件也被删除了
```

## TODOS

- [x] 支持Mac和Windows多屏幕截图
- [x] 支持程序日志记录功能，只记录了console.error信息
- [x] 支持配置程序是否开机启动
- [x] 支持配置截图时是否隐藏当前窗口
- [x] 支持配置截图快捷键
- [x] 支持配置显示窗口快捷键
- [x] 支持截完图后要弹出提示框，并且将图片复制到粘贴板
- [ ] 解决截图延迟问题。根据操作系统、屏幕的数量及分辨率，延迟时间不一定，区间在于100ms ~ 1000ms
- [ ] Linux支持多屏幕截图。由于Chromium的原因，Linux暂时只支持单屏截图。参考：https://github.com/electron/electron/issues/21321


## 日志

	- windows:
		1. 打开C盘，然后进入Users(用户)文件夹
		2. 进入登录用户的文件夹，比如xudeming
		3. 找到.electron-capture-log.txt
	- mac:
		1. 右键点击Finder(访达)，点击“前往文件夹”
		2. 输入框中输入/，点击前往按钮即可打开根目录
		3. 点击用户文件夹，然后点击登录用户的文件夹，比如xudeming
		4. 如果没有显示隐藏文件夹，可以按下快捷键`command + shift + .`显示隐藏文件
		5. 找到.electron-capture-log.txt
	- linux:
		1. 执行命令`cd ~`
		2. 找到.electron-capture-log.txt