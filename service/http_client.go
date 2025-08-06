package service

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"one-api/common"
	"sync"
	"time"

	"golang.org/x/net/proxy"
)

var httpClient *http.Client
var impatientHTTPClient *http.Client
var longTimeoutHTTPClient *http.Client // 为长时间非流式请求专用
var initOnce sync.Once

// 延迟初始化HTTP客户端，确保在环境变量加载后执行
func initHTTPClients() {
	// 根据RelayTimeout配置决定超时时间
	var timeout time.Duration
	if common.RelayTimeout == 0 || common.RelayTimeout > 3600 {
		// 如果没有配置RelayTimeout或配置过大，使用默认的1800秒（30分钟）
		timeout = 18000 * time.Second
	} else {
		// 使用配置的RelayTimeout值
		timeout = time.Duration(common.RelayTimeout) * time.Second
	}

	httpClient = &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second, // 优化：连接超时30秒
				KeepAlive: 30 * time.Second,
			}).DialContext,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          500, // 优化：增加最大空闲连接数
			MaxIdleConnsPerHost:   200, // 优化：增加每个主机的最大空闲连接数
			MaxConnsPerHost:       200, // 优化：增加每个主机的最大连接数
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   30 * time.Second,   // 优化：TLS握手超时15秒
			ResponseHeaderTimeout: 2400 * time.Second, // 优化：响应头超时60秒
			ExpectContinueTimeout: 1 * time.Second,
			DisableCompression:    false,     // 启用压缩
			WriteBufferSize:       64 * 1024, // 优化：64KB写缓冲区
			ReadBufferSize:        64 * 1024, // 优化：64KB读缓冲区
		},
	}

	impatientHTTPClient = &http.Client{
		Timeout: 5 * time.Second,
	}

	// 为非流式长时间请求创建专用客户端
	// 非流式请求（如 /v1/messages 和 /v1/chat/completions）使用更长的超时时间
	longTimeout := 3600 * time.Second // 默认60分钟
	if common.RelayTimeout > 0 && common.RelayTimeout <= 3600 {
		// 如果用户配置了合理的超时时间，使用配置值的2倍或至少30分钟
		longTimeout = time.Duration(common.RelayTimeout*2) * time.Second
		if longTimeout < 30*time.Minute {
			longTimeout = 30 * time.Minute
		}
	}

	longTimeoutHTTPClient = &http.Client{
		Timeout: longTimeout,
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   60 * time.Second, // 长时间请求保持60秒
				KeepAlive: 30 * time.Second,
			}).DialContext,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          300, // 优化：增加连接池大小
			MaxIdleConnsPerHost:   100,
			MaxConnsPerHost:       100, // 优化：限制并发连接
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   30 * time.Second,   // 优化：TLS握手超时15秒
			ResponseHeaderTimeout: 2400 * time.Second, // 优化：响应头超时60秒
			// ResponseHeaderTimeout 不设置或设置为0，让总的Timeout控制超时
			// 对于非流式长时间请求，服务器可能需要很长时间处理才返回响应头
			// ResponseHeaderTimeout: 0, // 不限制响应头超时，由总Timeout控制
			ExpectContinueTimeout: 1 * time.Second,
			DisableCompression:    false,     // 启用压缩
			WriteBufferSize:       64 * 1024, // 优化：64KB写缓冲区
			ReadBufferSize:        64 * 1024, // 优化：64KB读缓冲区
		},
	}
}

func GetHttpClient() *http.Client {
	initOnce.Do(initHTTPClients)
	return httpClient
}

func GetImpatientHttpClient() *http.Client {
	initOnce.Do(initHTTPClients)
	return impatientHTTPClient
}

func GetLongTimeoutHttpClient() *http.Client {
	initOnce.Do(initHTTPClients)
	return longTimeoutHTTPClient
}

// InitHTTPClients 公开的初始化函数，供main.go调用
func InitHTTPClients() {
	initOnce.Do(initHTTPClients)
}

// NewProxyHttpClient 创建支持代理的 HTTP 客户端
func NewProxyHttpClient(proxyURL string) (*http.Client, error) {
	return NewProxyHttpClientWithTimeout(proxyURL, 0) // 使用默认超时
}

// NewProxyHttpClientWithTimeout 创建支持代理的 HTTP 客户端，带指定超时
func NewProxyHttpClientWithTimeout(proxyURL string, timeout time.Duration) (*http.Client, error) {
	if proxyURL == "" {
		if timeout > 0 {
			return &http.Client{Timeout: timeout}, nil
		}
		return http.DefaultClient, nil
	}

	// 如果没有指定超时，使用RelayTimeout配置
	if timeout == 0 {
		if common.RelayTimeout == 0 || common.RelayTimeout > 3600 {
			// 如果RelayTimeout未设置或过大，使用合理的默认值
			timeout = 1800 * time.Second // 30分钟
		} else {
			timeout = time.Duration(common.RelayTimeout) * time.Second
		}
	}

	parsedURL, err := url.Parse(proxyURL)
	if err != nil {
		return nil, err
	}

	switch parsedURL.Scheme {
	case "http", "https":
		return &http.Client{
			Timeout: timeout,
			Transport: &http.Transport{
				Proxy: http.ProxyURL(parsedURL),
			},
		}, nil

	case "socks5", "socks5h":
		// 获取认证信息
		var auth *proxy.Auth
		if parsedURL.User != nil {
			auth = &proxy.Auth{
				User:     parsedURL.User.Username(),
				Password: "",
			}
			if password, ok := parsedURL.User.Password(); ok {
				auth.Password = password
			}
		}

		// 创建 SOCKS5 代理拨号器
		// proxy.SOCKS5 使用 tcp 参数，所有 TCP 连接包括 DNS 查询都将通过代理进行。行为与 socks5h 相同
		dialer, err := proxy.SOCKS5("tcp", parsedURL.Host, auth, proxy.Direct)
		if err != nil {
			return nil, err
		}

		return &http.Client{
			Timeout: timeout,
			Transport: &http.Transport{
				DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
					return dialer.Dial(network, addr)
				},
			},
		}, nil

	default:
		return nil, fmt.Errorf("unsupported proxy scheme: %s", parsedURL.Scheme)
	}
}
