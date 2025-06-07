package service

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"one-api/common"
	"time"

	"golang.org/x/net/proxy"
)

var httpClient *http.Client
var impatientHTTPClient *http.Client
var longTimeoutHTTPClient *http.Client // 为长时间非流式请求专用

func init() {
	// 根据RelayTimeout配置决定超时时间
	var timeout time.Duration
	if common.RelayTimeout == 0 {
		// 如果没有配置RelayTimeout，使用默认的300秒
		timeout = time.Duration(300) * time.Second
	} else {
		// 使用配置的RelayTimeout值
		timeout = time.Duration(common.RelayTimeout) * time.Second
	}

	httpClient = &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   60 * time.Second,  // 连接超时60秒
				KeepAlive: 30 * time.Second,
			}).DialContext,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   30 * time.Second,  // TLS握手超时30秒
			ResponseHeaderTimeout: 120 * time.Second, // 响应头超时120秒
			ExpectContinueTimeout: 1 * time.Second,
			MaxIdleConnsPerHost:   100,
		},
	}

	//if common.RelayTimeout == 0 {
	//	httpClient = &http.Client{}
	//} else {
	//	httpClient = &http.Client{
	//		Timeout: time.Duration(common.RelayTimeout) * time.Second,
	//	}
	//}

	impatientHTTPClient = &http.Client{
		Timeout: 5 * time.Second,
	}

	// 为非流式长时间请求创建专用客户端
	longTimeout := timeout
	// 如果配置的超时时间小于15分钟，对于非流式请求使用15分钟
	if longTimeout < 15*time.Minute {
		longTimeout = 15 * time.Minute
	}
	
	longTimeoutHTTPClient = &http.Client{
		Timeout: longTimeout,
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   120 * time.Second, // 连接超时120秒，更宽松
				KeepAlive: 30 * time.Second,
			}).DialContext,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   60 * time.Second,  // TLS握手超时60秒，更宽松
			ResponseHeaderTimeout: 300 * time.Second, // 响应头超时5分钟，更宽松
			ExpectContinueTimeout: 1 * time.Second,
			MaxIdleConnsPerHost:   100,
		},
	}
}

func GetHttpClient() *http.Client {
	return httpClient
}

func GetImpatientHttpClient() *http.Client {
	return impatientHTTPClient
}

func GetLongTimeoutHttpClient() *http.Client {
	return longTimeoutHTTPClient
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
		if common.RelayTimeout == 0 {
			timeout = time.Duration(300) * time.Second
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
