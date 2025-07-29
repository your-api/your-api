package helper

import (
	"bufio"
	"bytes"
	"io"
	"net/http"
	"one-api/common"
	"sync"
)

// StreamOptimizer 流式响应优化器
type StreamOptimizer struct {
	reader     *bufio.Reader
	buffer     *bytes.Buffer
	bufferPool *sync.Pool
}

// NewStreamOptimizer 创建流式响应优化器
func NewStreamOptimizer(resp *http.Response) *StreamOptimizer {
	return &StreamOptimizer{
		reader: bufio.NewReaderSize(resp.Body, 64*1024), // 64KB缓冲区
		buffer: &bytes.Buffer{},
		bufferPool: &sync.Pool{
			New: func() interface{} {
				return make([]byte, 4096) // 4KB缓冲池
			},
		},
	}
}

// ReadLine 优化的读行方法
func (so *StreamOptimizer) ReadLine() ([]byte, error) {
	// 从池中获取缓冲区
	buf := so.bufferPool.Get().([]byte)
	defer so.bufferPool.Put(buf)
	
	so.buffer.Reset()
	
	for {
		// 读取到换行符或EOF
		line, isPrefix, err := so.reader.ReadLine()
		if err != nil {
			if err == io.EOF && so.buffer.Len() > 0 {
				return so.buffer.Bytes(), io.EOF
			}
			return nil, err
		}
		
		// 将数据写入缓冲区
		so.buffer.Write(line)
		
		// 如果没有更多数据，返回完整的行
		if !isPrefix {
			return so.buffer.Bytes(), nil
		}
		
		// 防止缓冲区过大
		if so.buffer.Len() > 1024*1024 { // 1MB限制
			common.LogError(nil, "Stream line too large, truncating")
			return so.buffer.Bytes(), nil
		}
	}
}

// Close 关闭优化器
func (so *StreamOptimizer) Close() error {
	so.buffer.Reset()
	return nil
}

// StreamCopier 优化的流复制器
type StreamCopier struct {
	bufferSize int
	bufferPool *sync.Pool
}

// NewStreamCopier 创建流复制器
func NewStreamCopier(bufferSize int) *StreamCopier {
	if bufferSize <= 0 {
		bufferSize = 32 * 1024 // 默认32KB
	}
	
	return &StreamCopier{
		bufferSize: bufferSize,
		bufferPool: &sync.Pool{
			New: func() interface{} {
				return make([]byte, bufferSize)
			},
		},
	}
}

// Copy 优化的流复制
func (sc *StreamCopier) Copy(dst io.Writer, src io.Reader) (int64, error) {
	buf := sc.bufferPool.Get().([]byte)
	defer sc.bufferPool.Put(buf)
	
	var written int64
	for {
		nr, err := src.Read(buf)
		if nr > 0 {
			nw, ew := dst.Write(buf[0:nr])
			if nw > 0 {
				written += int64(nw)
			}
			if ew != nil {
				return written, ew
			}
			if nr != nw {
				return written, io.ErrShortWrite
			}
			
			// 如果是http.Flusher，立即刷新
			if f, ok := dst.(http.Flusher); ok {
				f.Flush()
			}
		}
		if err != nil {
			if err == io.EOF {
				break
			}
			return written, err
		}
	}
	return written, nil
}