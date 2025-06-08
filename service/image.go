package service

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	"io"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"strings"

	"golang.org/x/image/webp"
)

func DecodeBase64ImageData(base64String string) (image.Config, string, string, error) {
	// 去除base64数据的URL前缀（如果有）
	if idx := strings.Index(base64String, ","); idx != -1 {
		base64String = base64String[idx+1:]
	}

	// 将base64字符串解码为字节切片
	decodedData, err := base64.StdEncoding.DecodeString(base64String)
	if err != nil {
		fmt.Println("Error: Failed to decode base64 string")
		return image.Config{}, "", "", fmt.Errorf("failed to decode base64 string: %s", err.Error())
	}

	// 创建一个bytes.Buffer用于存储解码后的数据
	reader := bytes.NewReader(decodedData)
	config, format, err := getImageConfig(reader)
	return config, format, base64String, err
}

func DecodeBase64FileData(base64String string) (string, string, error) {
	var mimeType string
	var idx int
	idx = strings.Index(base64String, ",")
	if idx == -1 {
		_, file_type, base64, err := DecodeBase64ImageData(base64String)
		return "image/" + file_type, base64, err
	}
	mimeType = base64String[:idx]
	base64String = base64String[idx+1:]
	idx = strings.Index(mimeType, ";")
	if idx == -1 {
		_, file_type, base64, err := DecodeBase64ImageData(base64String)
		return "image/" + file_type, base64, err
	}
	mimeType = mimeType[:idx]
	idx = strings.Index(mimeType, ":")
	if idx == -1 {
		_, file_type, base64, err := DecodeBase64ImageData(base64String)
		return "image/" + file_type, base64, err
	}
	mimeType = mimeType[idx+1:]
	return mimeType, base64String, nil
}

// GetImageFromUrl 获取图片的类型和base64编码的数据
func GetImageFromUrl(url string) (mimeType string, data string, err error) {
	resp, err := DoDownloadRequest(url)
	if err != nil {
		return "", "", fmt.Errorf("failed to download image: %w", err)
	}
	defer resp.Body.Close()

	// Check HTTP status code
	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("failed to download image: HTTP %d", resp.StatusCode)
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType != "application/octet-stream" && !strings.HasPrefix(contentType, "image/") {
		return "", "", fmt.Errorf("invalid content type: %s, required image/*", contentType)
	}
	maxImageSize := int64(constant.MaxFileDownloadMB * 1024 * 1024)

	// Check Content-Length if available
	if resp.ContentLength > maxImageSize {
		return "", "", fmt.Errorf("image size %d exceeds maximum allowed size of %d bytes", resp.ContentLength, maxImageSize)
	}

	// Use LimitReader to prevent reading oversized images
	limitReader := io.LimitReader(resp.Body, maxImageSize)
	buffer := &bytes.Buffer{}

	written, err := io.Copy(buffer, limitReader)
	if err != nil {
		return "", "", fmt.Errorf("failed to read image data: %w", err)
	}
	if written >= maxImageSize {
		return "", "", fmt.Errorf("image size exceeds maximum allowed size of %d bytes", maxImageSize)
	}

	data = base64.StdEncoding.EncodeToString(buffer.Bytes())
	mimeType = contentType

	// Handle application/octet-stream type
	if mimeType == "application/octet-stream" {
		_, format, _, err := DecodeBase64ImageData(data)
		if err != nil {
			return "", "", err
		}
		mimeType = "image/" + format
	}

	return mimeType, data, nil
}

func DecodeUrlImageData(imageUrl string) (image.Config, string, string, error) {
	if common.DebugEnabled {
		common.SysDebug(fmt.Sprintf("开始下载图片: %s", imageUrl))
	}
	
	response, err := DoDownloadRequest(imageUrl)
	if err != nil {
		common.SysLog(fmt.Sprintf("fail to get image from url: %s", err.Error()))
		return image.Config{}, "", "", err
	}
	defer response.Body.Close()

	if response.StatusCode != 200 {
		err = errors.New(fmt.Sprintf("fail to get image from url: %s", response.Status))
		common.SysLog(fmt.Sprintf("图片下载HTTP状态错误: %d, URL: %s", response.StatusCode, imageUrl))
		return image.Config{}, "", "", err
	}

	mimeType := response.Header.Get("Content-Type")
	if common.DebugEnabled {
		common.SysDebug(fmt.Sprintf("图片下载成功，Content-Type: %s", mimeType))
	}

	if mimeType != "application/octet-stream" && !strings.HasPrefix(mimeType, "image/") {
		return image.Config{}, "", "", fmt.Errorf("invalid content type: %s, required image/*", mimeType)
	}

	// 读取完整的图片数据
	maxSize := int64(constant.MaxFileDownloadMB * 1024 * 1024)
	limitReader := io.LimitReader(response.Body, maxSize)
	imageData, err := io.ReadAll(limitReader)
	if err != nil {
		return image.Config{}, "", "", fmt.Errorf("failed to read image data: %w", err)
	}

	if common.DebugEnabled {
		common.SysDebug(fmt.Sprintf("图片数据读取完成，大小: %d bytes", len(imageData)))
	}

	// 标准化MIME类型，如果是octet-stream，根据图片格式推断
	format := ""
	configReader := bytes.NewReader(imageData)
	config, detectedFormat, err := getImageConfig(configReader)
	if err != nil {
		if common.DebugEnabled {
			common.SysDebug(fmt.Sprintf("图片配置解析失败: %v", err))
		}
		return image.Config{}, "", "", err
	}

	// 确定最终的MIME类型
	if mimeType == "application/octet-stream" {
		format = detectedFormat
		mimeType = "image/" + detectedFormat
	} else {
		format = detectedFormat
	}

	// 对图片数据进行base64编码，并添加正确的前缀
	base64Data := base64.StdEncoding.EncodeToString(imageData)
	base64WithPrefix := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)

	if common.DebugEnabled {
		common.SysDebug(fmt.Sprintf("图片base64转换完成，格式: %s，base64长度: %d", format, len(base64WithPrefix)))
	}

	return config, format, base64WithPrefix, nil
}

func getImageConfig(reader io.Reader) (image.Config, string, error) {
	// 读取图片的头部信息来获取图片尺寸
	config, format, err := image.DecodeConfig(reader)
	if err != nil {
		err = errors.New(fmt.Sprintf("fail to decode image config(gif, jpg, png): %s", err.Error()))
		common.SysLog(err.Error())
		config, err = webp.DecodeConfig(reader)
		if err != nil {
			err = errors.New(fmt.Sprintf("fail to decode image config(webp): %s", err.Error()))
			common.SysLog(err.Error())
		}
		format = "webp"
	}
	if err != nil {
		return image.Config{}, "", err
	}
	return config, format, nil
}
