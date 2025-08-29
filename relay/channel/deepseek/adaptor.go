package deepseek

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
	"one-api/relay/channel"
	"one-api/relay/channel/openai"
	relaycommon "one-api/relay/common"
	"one-api/relay/constant"
	"one-api/types"
	"strings"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ClaudeRequest) (any, error) {
	adaptor := openai.Adaptor{}
	return adaptor.ConvertClaudeRequest(c, info, req)
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	fimBaseUrl := info.ChannelBaseUrl
	if !strings.HasSuffix(info.ChannelBaseUrl, "/beta") {
		fimBaseUrl += "/beta"
	}
	switch info.RelayMode {
	case constant.RelayModeCompletions:
		return fmt.Sprintf("%s/completions", fimBaseUrl), nil
	default:
		return fmt.Sprintf("%s/v1/chat/completions", info.ChannelBaseUrl), nil
	}
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	
	// 🔒 安全检查：确保不泄露HTTP图片链接，防止暴露源站IP
	for msgIndex := range request.Messages {
		message := &request.Messages[msgIndex]
		if message.Content != nil {
			arrayContent := message.ParseContent()
			hasModification := false
			newContent := make([]dto.MediaContent, 0, len(arrayContent))
			
			for _, content := range arrayContent {
				if content.Type == dto.ContentTypeImageURL {
					imageUrl := content.GetImageMedia()
					if imageUrl != nil && strings.HasPrefix(imageUrl.Url, "http") {
						if common.DebugEnabled {
							common.SysLog(fmt.Sprintf("⚠️ DeepSeek适配器发现HTTP图片链接未转换，为防止暴露源站IP，删除该图片: %s", imageUrl.Url))
						}
						hasModification = true
						// 跳过HTTP图片链接，不添加到新内容中
						continue
					}
				}
				newContent = append(newContent, content)
			}
			
			// 如果有修改，更新消息内容
			if hasModification {
				message.SetMediaContent(newContent)
				if common.DebugEnabled {
					common.SysLog(fmt.Sprintf("DeepSeek适配器已更新消息内容，原始内容数: %d，最终内容数: %d", len(arrayContent), len(newContent)))
				}
			}
		}
	}
	
	return request, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	// TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.IsStream {
		usage, err = openai.OaiStreamHandler(c, info, resp)
	} else {
		usage, err = openai.OpenaiHandler(c, info, resp)
	}
	return
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
