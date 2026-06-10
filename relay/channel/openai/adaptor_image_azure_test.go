package openai

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestConvertImageRequestAzureGenerationOmitsModel(t *testing.T) {
	gin.SetMode(gin.TestMode)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/images/generations", nil)

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeAzure},
	}
	request := dto.ImageRequest{
		Model:   "gpt-image-1.5-1",
		Prompt:  "test",
		Quality: "high",
		Size:    "1024x1024",
	}

	got, err := adaptor.ConvertImageRequest(c, info, request)
	require.NoError(t, err)

	jsonData, err := common.Marshal(got)
	require.NoError(t, err)

	require.False(t, gjson.GetBytes(jsonData, "model").Exists())
	require.Equal(t, "test", gjson.GetBytes(jsonData, "prompt").String())
	require.Equal(t, "high", gjson.GetBytes(jsonData, "quality").String())
	require.Equal(t, "1024x1024", gjson.GetBytes(jsonData, "size").String())
}

func TestConvertImageRequestOpenAIGenerationKeepsModel(t *testing.T) {
	gin.SetMode(gin.TestMode)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/images/generations", nil)

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeOpenAI},
	}
	request := dto.ImageRequest{
		Model:  "gpt-image-1.5",
		Prompt: "test",
	}

	got, err := adaptor.ConvertImageRequest(c, info, request)
	require.NoError(t, err)

	jsonData, err := common.Marshal(got)
	require.NoError(t, err)
	require.Equal(t, "gpt-image-1.5", gjson.GetBytes(jsonData, "model").String())
}

func TestConvertImageRequestAzureEditsOmitsModelMultipartField(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	require.NoError(t, writer.WriteField("prompt", "edit me"))
	part, err := writer.CreateFormFile("image", "test.png")
	require.NoError(t, err)
	_, err = io.Copy(part, strings.NewReader("pngdata"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest("POST", "/v1/images/edits", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	c.Request = req
	require.NoError(t, req.ParseMultipartForm(1<<20))

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeImagesEdits,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelType: constant.ChannelTypeAzure},
	}
	request := dto.ImageRequest{
		Model:  "gpt-image-1.5-1",
		Prompt: "edit me",
	}

	got, err := adaptor.ConvertImageRequest(c, info, request)
	require.NoError(t, err)

	buf, ok := got.(*bytes.Buffer)
	require.True(t, ok)
	payload := buf.String()
	require.Contains(t, payload, `name="prompt"`)
	require.NotContains(t, payload, `name="model"`)
}
