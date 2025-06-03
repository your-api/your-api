package channel

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	common2 "one-api/common"
	"one-api/relay/common"
	"one-api/relay/constant"
	"one-api/relay/helper"
	"one-api/service"
	"one-api/setting/operation_setting"
	"sync"
	"time"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func SetupApiRequestHeader(info *common.RelayInfo, c *gin.Context, req *http.Header) {
	if info.RelayMode == constant.RelayModeAudioTranscription || info.RelayMode == constant.RelayModeAudioTranslation {
		// multipart/form-data
	} else if info.RelayMode == constant.RelayModeRealtime {
		// websocket
	} else {
		req.Set("Content-Type", c.Request.Header.Get("Content-Type"))
		req.Set("Accept", c.Request.Header.Get("Accept"))
		if info.IsStream && c.Request.Header.Get("Accept") == "" {
			req.Set("Accept", "text/event-stream")
		}
	}
}

func DoApiRequest(a Adaptor, c *gin.Context, info *common.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	fullRequestURL, err := a.GetRequestURL(info)
	if err != nil {
		return nil, fmt.Errorf("get request url failed: %w", err)
	}
	if common2.DebugEnabled {
		println("fullRequestURL:", fullRequestURL)
	}
	req, err := http.NewRequest(c.Request.Method, fullRequestURL, requestBody)
	if err != nil {
		return nil, fmt.Errorf("new request failed: %w", err)
	}
	err = a.SetupRequestHeader(c, &req.Header, info)
	if err != nil {
		return nil, fmt.Errorf("setup request header failed: %w", err)
	}
	resp, err := doRequest(c, req, info)
	if err != nil {
		return nil, fmt.Errorf("do request failed: %w", err)
	}
	return resp, nil
}

func DoFormRequest(a Adaptor, c *gin.Context, info *common.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	fullRequestURL, err := a.GetRequestURL(info)
	if err != nil {
		return nil, fmt.Errorf("get request url failed: %w", err)
	}
	if common2.DebugEnabled {
		println("fullRequestURL:", fullRequestURL)
	}
	req, err := http.NewRequest(c.Request.Method, fullRequestURL, requestBody)
	if err != nil {
		return nil, fmt.Errorf("new request failed: %w", err)
	}
	// set form data
	req.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))

	err = a.SetupRequestHeader(c, &req.Header, info)
	if err != nil {
		return nil, fmt.Errorf("setup request header failed: %w", err)
	}
	resp, err := doRequest(c, req, info)
	if err != nil {
		return nil, fmt.Errorf("do request failed: %w", err)
	}
	return resp, nil
}

func DoWssRequest(a Adaptor, c *gin.Context, info *common.RelayInfo, requestBody io.Reader) (*websocket.Conn, error) {
	fullRequestURL, err := a.GetRequestURL(info)
	if err != nil {
		return nil, fmt.Errorf("get request url failed: %w", err)
	}
	targetHeader := http.Header{}
	err = a.SetupRequestHeader(c, &targetHeader, info)
	if err != nil {
		return nil, fmt.Errorf("setup request header failed: %w", err)
	}
	targetHeader.Set("Content-Type", c.Request.Header.Get("Content-Type"))
	targetConn, _, err := websocket.DefaultDialer.Dial(fullRequestURL, targetHeader)
	if err != nil {
		return nil, fmt.Errorf("dial failed to %s: %w", fullRequestURL, err)
	}
	// send request body
	//all, err := io.ReadAll(requestBody)
	//err = service.WssString(c, targetConn, string(all))
	return targetConn, nil
}

func startPingKeepAlive(c *gin.Context, pingInterval time.Duration) context.CancelFunc {
	pingerCtx, stopPinger := context.WithCancel(context.Background())

	gopool.Go(func() {
		defer func() {
			if common2.DebugEnabled {
				println("SSE ping goroutine stopped.")
			}
		}()

		if pingInterval <= 0 {
			pingInterval = helper.DefaultPingInterval
		}

		ticker := time.NewTicker(pingInterval)
		// 退出时清理 ticker
		defer ticker.Stop()

		var pingMutex sync.Mutex
		if common2.DebugEnabled {
			println("SSE ping goroutine started")
		}

		for {
			select {
			// 发送 ping 数据
			case <-ticker.C:
				if err := sendPingData(c, &pingMutex); err != nil {
					return
				}
			// 收到退出信号
			case <-pingerCtx.Done():
				return
			// request 结束
			case <-c.Request.Context().Done():
				return
			}
		}
	})

	return stopPinger
}

func sendPingData(c *gin.Context, mutex *sync.Mutex) error {
	mutex.Lock()
	defer mutex.Unlock()

	err := helper.PingData(c)
	if err != nil {
		common2.LogError(c, "SSE ping error: "+err.Error())
		return err
	}

	if common2.DebugEnabled {
		println("SSE ping data sent.")
	}
	return nil
}

func doRequest(c *gin.Context, req *http.Request, info *common.RelayInfo) (*http.Response, error) {
	var client *http.Client
	var err error
	if info.Proxy != "" {
		// Proxy 非空，使用代理
		client, err = service.NewProxyHttpClient(info.Proxy)
		if err != nil {
			return nil, fmt.Errorf("new proxy http client failed: %w", err)
		}
	} else {
		client = service.GetHttpClient()
	}

	if info.IsStream {
		helper.SetEventStreamHeaders(c)

		// 处理流式请求的 ping 保活
		generalSettings := operation_setting.GetGeneralSetting()
		if generalSettings.PingIntervalEnabled {
			pingInterval := time.Duration(generalSettings.PingIntervalSeconds) * time.Second
			stopPinger := startPingKeepAlive(c, pingInterval)
			defer stopPinger()
		}
	}

	resp, err := client.Do(req)

	if err != nil {
		return nil, err
	}
	if resp == nil {
		return nil, errors.New("resp is nil")
	}

	_ = req.Body.Close()
	_ = c.Request.Body.Close()
	return resp, nil
}

func DoTaskApiRequest(a TaskAdaptor, c *gin.Context, info *common.TaskRelayInfo, requestBody io.Reader) (*http.Response, error) {
	fullRequestURL, err := a.BuildRequestURL(info)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(c.Request.Method, fullRequestURL, requestBody)
	if err != nil {
		return nil, fmt.Errorf("new request failed: %w", err)
	}
	req.GetBody = func() (io.ReadCloser, error) {
		return io.NopCloser(requestBody), nil
	}

	err = a.BuildRequestHeader(c, req, info)
	if err != nil {
		return nil, fmt.Errorf("setup request header failed: %w", err)
	}
	resp, err := doRequest(c, req, info.RelayInfo)
	if err != nil {
		return nil, fmt.Errorf("do request failed: %w", err)
	}
	return resp, nil
}
