import { Toast, Pagination } from '@douyinfe/semi-ui';
import { toastConstants } from '../constants';
import React from 'react';
import { toast } from 'react-toastify';

const HTMLToastContent = ({ htmlContent }) => {
  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};
export default HTMLToastContent;
export function isAdmin() {
  let user = localStorage.getItem('user');
  if (!user) return false;
  user = JSON.parse(user);
  return user.role >= 10;
}

export function isRoot() {
  let user = localStorage.getItem('user');
  if (!user) return false;
  user = JSON.parse(user);
  return user.role >= 100;
}

export function getSystemName() {
  let system_name = localStorage.getItem('system_name');
  if (!system_name) return 'Your API';
  return system_name;
}

export function getLogo() {
  let logo = localStorage.getItem('logo');
  if (!logo) return '/logo.png';
  return logo;
}

export function getUserIdFromLocalStorage() {
  let user = localStorage.getItem('user');
  if (!user) return -1;
  user = JSON.parse(user);
  return user.id;
}

export function getFooterHTML() {
  return localStorage.getItem('footer_html');
}

export async function copy(text) {
  let okay = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    try {
      // 构建input 执行 复制命令
      var _input = window.document.createElement('input');
      _input.value = text;
      window.document.body.appendChild(_input);
      _input.select();
      window.document.execCommand('Copy');
      window.document.body.removeChild(_input);
    } catch (e) {
      okay = false;
      console.error(e);
    }
  }
  return okay;
}

export function isMobile() {
  return window.innerWidth <= 600;
}

let showErrorOptions = { autoClose: toastConstants.ERROR_TIMEOUT };
let showWarningOptions = { autoClose: toastConstants.WARNING_TIMEOUT };
let showSuccessOptions = { autoClose: toastConstants.SUCCESS_TIMEOUT };
let showInfoOptions = { autoClose: toastConstants.INFO_TIMEOUT };
let showNoticeOptions = { autoClose: false };

if (isMobile()) {
  showErrorOptions.position = 'top-center';
  // showErrorOptions.transition = 'flip';

  showSuccessOptions.position = 'top-center';
  // showSuccessOptions.transition = 'flip';

  showInfoOptions.position = 'top-center';
  // showInfoOptions.transition = 'flip';

  showNoticeOptions.position = 'top-center';
  // showNoticeOptions.transition = 'flip';
}

export function showError(error) {
  console.error(error);
  if (error.message) {
    if (error.name === 'AxiosError') {
      switch (error.response.status) {
        case 401:
          // toast.error('错误：未登录或登录已过期，请重新登录！', showErrorOptions);
          window.location.href = '/login?expired=true';
          break;
        case 429:
          Toast.error('错误：请求次数过多，请稍后再试！');
          break;
        case 500:
          Toast.error('错误：服务器内部错误，请联系管理员！');
          break;
        case 405:
          Toast.info('本站仅作演示之用，无服务端！');
          break;
        default:
          Toast.error('错误：' + error.message);
      }
      return;
    }
    Toast.error('错误：' + error.message);
  } else {
    Toast.error('错误：' + error);
  }
}

export function showWarning(message) {
  Toast.warning(message);
}

export function showSuccess(message) {
  Toast.success(message);
}

export function showInfo(message) {
  Toast.info(message);
}

export function showNotice(message, isHTML = false) {
  if (isHTML) {
    toast(<HTMLToastContent htmlContent={message} />, showNoticeOptions);
  } else {
    Toast.info(message);
  }
}

export function openPage(url) {
  window.open(url);
}

export function removeTrailingSlash(url) {
  if (!url) return '';
  if (url.endsWith('/')) {
    return url.slice(0, -1);
  } else {
    return url;
  }
}

export function getTodayStartTimestamp() {
  var now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor(now.getTime() / 1000);
}

export function timestamp2string(timestamp) {
  let date = new Date(timestamp * 1000);
  let year = date.getFullYear().toString();
  let month = (date.getMonth() + 1).toString();
  let day = date.getDate().toString();
  let hour = date.getHours().toString();
  let minute = date.getMinutes().toString();
  let second = date.getSeconds().toString();
  if (month.length === 1) {
    month = '0' + month;
  }
  if (day.length === 1) {
    day = '0' + day;
  }
  if (hour.length === 1) {
    hour = '0' + hour;
  }
  if (minute.length === 1) {
    minute = '0' + minute;
  }
  if (second.length === 1) {
    second = '0' + second;
  }
  return (
    year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second
  );
}

export function timestamp2string1(timestamp, dataExportDefaultTime = 'hour') {
  let date = new Date(timestamp * 1000);
  // let year = date.getFullYear().toString();
  let month = (date.getMonth() + 1).toString();
  let day = date.getDate().toString();
  let hour = date.getHours().toString();
  if (day === '24') {
    console.log('timestamp', timestamp);
  }
  if (month.length === 1) {
    month = '0' + month;
  }
  if (day.length === 1) {
    day = '0' + day;
  }
  if (hour.length === 1) {
    hour = '0' + hour;
  }
  let str = month + '-' + day;
  if (dataExportDefaultTime === 'hour') {
    str += ' ' + hour + ':00';
  } else if (dataExportDefaultTime === 'week') {
    let nextWeek = new Date(timestamp * 1000 + 6 * 24 * 60 * 60 * 1000);
    let nextMonth = (nextWeek.getMonth() + 1).toString();
    let nextDay = nextWeek.getDate().toString();
    if (nextMonth.length === 1) {
      nextMonth = '0' + nextMonth;
    }
    if (nextDay.length === 1) {
      nextDay = '0' + nextDay;
    }
    str += ' - ' + nextMonth + '-' + nextDay;
  }
  return str;
}

export function downloadTextAsFile(text, filename) {
  let blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

export const verifyJSON = (str) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

export function verifyJSONPromise(value) {
  try {
    JSON.parse(value);
    return Promise.resolve();
  } catch (e) {
    return Promise.reject('不是合法的 JSON 字符串');
  }
}

export function shouldShowPrompt(id) {
  let prompt = localStorage.getItem(`prompt-${id}`);
  return !prompt;
}

export function setPromptShown(id) {
  localStorage.setItem(`prompt-${id}`, 'true');
}

/**
 * 比较两个对象的属性，找出有变化的属性，并返回包含变化属性信息的数组
 * @param {Object} oldObject - 旧对象
 * @param {Object} newObject - 新对象
 * @return {Array} 包含变化属性信息的数组，每个元素是一个对象，包含 key, oldValue 和 newValue
 */
export function compareObjects(oldObject, newObject) {
  const changedProperties = [];

  // 比较两个对象的属性
  for (const key in oldObject) {
    if (oldObject.hasOwnProperty(key) && newObject.hasOwnProperty(key)) {
      if (oldObject[key] !== newObject[key]) {
        changedProperties.push({
          key: key,
          oldValue: oldObject[key],
          newValue: newObject[key],
        });
      }
    }
  }

  return changedProperties;
}

// Add missing pagination helper
export function createCardProPagination({
  currentPage,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  isMobile,
  t,
}) {
  return (
    <Pagination
      currentPage={currentPage}
      pageSize={pageSize}
      total={total}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      pageSizeOpts={[10, 20, 50, 100]}
      showSizeChanger={true}
      showQuickJumper={true}
      size={isMobile ? 'small' : 'default'}
      style={{ flex: 1 }}
    />
  );
}

// Add missing filter helper
export function selectFilter(sugInput, option) {
  // Handle the filter logic for Select component
  // sugInput is the search string, option is the current option being evaluated
  if (!sugInput) return true;
  
  // Get the label text from the option
  const label = option.label || option.text || option.value || '';
  const searchStr = String(label).toLowerCase();
  const inputStr = String(sugInput).toLowerCase();
  
  // Return true if the option matches the search
  return searchStr.includes(inputStr);
}

// Add missing pricing helpers
export function resetPricingFilters() {
  // Reset pricing filters to default state
  return {
    vendors: [],
    groups: [],
    quotaTypes: [],
    endpointTypes: [],
    searchTerm: '',
  };
}

export function calculateModelPrice(params) {
  // 处理旧的调用方式兼容性
  if (typeof params === 'object' && !params.record) {
    // 新的调用方式，params是一个包含record的对象
    const model = arguments[0];
    const amount = arguments[1] || 1000000;
    const basePrice = model.price || 0;
    return (basePrice * amount) / 1000000;
  }
  
  const { record, selectedGroup, groupRatio, tokenUnit = 'K', displayPrice, currency = 'CNY' } = params;
  
  if (!record) return null;
  
  // 获取分组倍率，默认为1
  let currentGroupRatio = 1;
  if (selectedGroup && groupRatio) {
    // 如果selectedGroup是'default'或其他特定分组，使用对应的倍率
    currentGroupRatio = groupRatio[selectedGroup] || 1;
  }
  
  // 将tokenUnit转换为数值
  const tokenUnitValue = tokenUnit === 'M' ? 1000000 : 1000;
  
  // 按量计费 (quota_type === 0)
  if (record.quota_type === 0) {
    const modelRatio = parseFloat(record.model_ratio) || 0;
    const completionRatio = parseFloat(record.completion_ratio) || 1;
    
    // 计算价格
    // 基础价格：1倍率 = $2/1M tokens = $0.002/1K tokens (无汇率转换，1:1)
    const baseRatePerMillion = 2; // 2元/百万tokens
    const baseRatePerThousand = 0.002; // 0.002元/千tokens
    
    let inputPrice, outputPrice;
    
    if (tokenUnitValue === 1000000) {
      // 每百万 tokens 的价格
      inputPrice = modelRatio * currentGroupRatio * baseRatePerMillion;
      outputPrice = modelRatio * completionRatio * currentGroupRatio * baseRatePerMillion;
    } else {
      // 每千 tokens 的价格
      inputPrice = modelRatio * currentGroupRatio * baseRatePerThousand;
      outputPrice = modelRatio * completionRatio * currentGroupRatio * baseRatePerThousand;
    }
    
    return {
      type: 'usage',
      inputPrice: inputPrice || 0,
      outputPrice: outputPrice || 0,
      currency,
      tokenUnit: tokenUnitValue
    };
  }
  
  // 按次计费 (quota_type === 1)
  if (record.quota_type === 1) {
    const price = (parseFloat(record.model_price) || 0) * currentGroupRatio;
    return {
      type: 'count',
      price: price || 0,
      currency
    };
  }
  
  return null;
}

export function formatPriceInfo(priceData, t) {
  // 处理旧的调用方式兼容性
  if (typeof priceData === 'number') {
    return `￥${priceData.toFixed(4)}`;
  }
  
  if (!priceData) return '￥0.0000';
  
  // 处理新的价格数据格式
  if (typeof priceData === 'object' && priceData.type) {
    const currencySymbol = priceData.currency === 'CNY' ? '￥' : '￥';
    const unitLabel = priceData.tokenUnit === 1000000 ? '/M' : '/K';
    
    if (priceData.type === 'usage') {
      // 返回格式化的字符串，让组件自己渲染
      return {
        type: 'usage',
        input: `${currencySymbol}${priceData.inputPrice.toFixed(4)}${unitLabel}`,
        output: `${currencySymbol}${priceData.outputPrice.toFixed(4)}${unitLabel}`,
        inputLabel: t ? t('提示') : '提示',
        outputLabel: t ? t('补全') : '补全'
      };
    }
    
    if (priceData.type === 'count') {
      return {
        type: 'count',
        price: `${currencySymbol}${priceData.price.toFixed(4)}`,
        label: t ? t('每次') : '每次'
      };
    }
  }
  
  return '￥0.0000';
}

// Add missing message helpers
export function formatMessageForAPI(message) {
  // Format message for API submission
  if (typeof message === 'string') {
    return { content: message, role: 'user' };
  }
  return message;
}

export function isValidMessage(message) {
  // Check if message is valid
  if (!message) return false;
  if (typeof message === 'string') return message.trim().length > 0;
  if (typeof message === 'object') {
    return message.content && message.content.trim().length > 0;
  }
  return false;
}

// Commented out - duplicate functions defined later in the file
// // Add missing time helper
// export function getRelativeTime(dateString) {
//   if (!dateString) return '';
//   
//   const date = new Date(dateString);
//   const now = new Date();
//   const diffMs = now - date;
//   const diffSecs = Math.floor(diffMs / 1000);
//   const diffMins = Math.floor(diffSecs / 60);
//   const diffHours = Math.floor(diffMins / 60);
//   const diffDays = Math.floor(diffHours / 24);
//   const diffWeeks = Math.floor(diffDays / 7);
//   const diffMonths = Math.floor(diffDays / 30);
//   const diffYears = Math.floor(diffDays / 365);
//
//   if (diffSecs < 60) {
//     return '刚刚';
//   } else if (diffMins < 60) {
//     return `${diffMins}分钟前`;
//   } else if (diffHours < 24) {
//     return `${diffHours}小时前`;
//   } else if (diffDays < 7) {
//     return `${diffDays}天前`;
//   } else if (diffWeeks < 4) {
//     return `${diffWeeks}周前`;
//   } else if (diffMonths < 12) {
//     return `${diffMonths}个月前`;
//   } else {
//     return `${diffYears}年前`;
//   }
// }
//
// // Add missing date formatting helper
// export function formatDateTimeString(dateString) {
//   if (!dateString) return '';
//   const date = new Date(dateString);
//   return date.toLocaleString('zh-CN', {
//     year: 'numeric',
//     month: '2-digit',
//     day: '2-digit',
//     hour: '2-digit',
//     minute: '2-digit',
//     second: '2-digit'
//   });
// }

// Add missing table compact mode helpers
export function getTableCompactMode() {
  return localStorage.getItem('table_compact_mode') === 'true';
}

export function setTableCompactMode(value) {
  localStorage.setItem('table_compact_mode', value.toString());
}

// Add getRelativeTime function
export function getRelativeTime(timestamp) {
  if (!timestamp) return '';
  
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) {
    return '刚刚';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}分钟前`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}小时前`;
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}天前`;
  } else if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months}个月前`;
  } else {
    const years = Math.floor(diffInSeconds / 31536000);
    return `${years}年前`;
  }
}

// Add formatDateTimeString function
export function formatDateTimeString(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Add missing processIncompleteThinkTags function
export function processIncompleteThinkTags(content = '', reasoningContent = '') {
  // Process incomplete think tags in content
  let processedContent = content;
  let processedReasoningContent = reasoningContent;
  
  // Check if content has unclosed <think> tag
  const thinkStartIndex = content.lastIndexOf('<think>');
  const thinkEndIndex = content.lastIndexOf('</think>');
  
  if (thinkStartIndex > -1 && (thinkEndIndex === -1 || thinkStartIndex > thinkEndIndex)) {
    // Extract incomplete think content
    const incompleteThinkContent = content.substring(thinkStartIndex + 7);
    
    // Remove the incomplete think tag from content
    processedContent = content.substring(0, thinkStartIndex);
    
    // Add the incomplete content to reasoning content
    if (processedReasoningContent) {
      processedReasoningContent += incompleteThinkContent;
    } else {
      processedReasoningContent = incompleteThinkContent;
    }
  }
  
  // Clean up any incomplete closing tags
  if (processedContent.endsWith('</') || processedContent.endsWith('<')) {
    processedContent = processedContent.replace(/<?\/?$/, '');
  }
  
  return {
    content: processedContent,
    reasoningContent: processedReasoningContent
  };
}

// Add missing processThinkTags function
export function processThinkTags(content = '', reasoningContent = '') {
  // Process complete think tags in content
  let processedContent = content;
  let processedReasoningContent = reasoningContent || '';
  
  // Regular expression to match <think>...</think> blocks
  const thinkTagRegex = /<think>([\s\S]*?)<\/think>/g;
  
  // Extract all think blocks
  let match;
  while ((match = thinkTagRegex.exec(content)) !== null) {
    // Add the think content to reasoning content
    if (processedReasoningContent) {
      processedReasoningContent += '\n' + match[1];
    } else {
      processedReasoningContent = match[1];
    }
  }
  
  // Remove all think blocks from the main content
  processedContent = content.replace(thinkTagRegex, '');
  
  // Clean up extra whitespace
  processedContent = processedContent.trim();
  
  return {
    content: processedContent,
    reasoningContent: processedReasoningContent
  };
}

// Add missing getTextContent function
export function getTextContent(content) {
  if (Array.isArray(content)) {
    const textItem = content.find(item => item.type === 'text');
    return textItem && textItem.text && typeof textItem.text === 'string' ? textItem.text : '';
  } else if (typeof content === 'string') {
    return content;
  }
  return '';
}

// Add missing createLoadingAssistantMessage function
export function createLoadingAssistantMessage() {
  return {
    role: 'assistant',
    content: '',
    status: 'loading',
    timestamp: Date.now(),
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
}

// Add missing buildMessageContent function
export function buildMessageContent(text) {
  return text || '';
}

// Add missing createMessage function
export function createMessage(role, content) {
  return {
    role: role,
    content: content,
    status: 'complete',
    timestamp: Date.now(),
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
}
