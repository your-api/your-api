import { Toast, Pagination } from '@douyinfe/semi-ui';
import { toastConstants } from '../constants';
import React from 'react';
import { toast } from 'react-toastify';
import { THINK_TAG_REGEX, MESSAGE_ROLES } from '../constants/playground.constants';
import { TABLE_COMPACT_MODES_KEY } from '../constants';
import { MOBILE_BREAKPOINT } from '../hooks/common/useIsMobile';

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

// -------------------------------
// Select 组件统一过滤逻辑
// 使用方式： <Select filter={selectFilter} ... />
// 统一的 Select 搜索过滤逻辑 -- 支持同时匹配 option.value 与 option.label
export const selectFilter = (input, option) => {
  if (!input) return true;

  const keyword = input.trim().toLowerCase();
  const valueText = (option?.value ?? '').toString().toLowerCase();
  const labelText = (option?.label ?? '').toString().toLowerCase();

  return valueText.includes(keyword) || labelText.includes(keyword);
};

// -------------------------------
// 模型定价计算工具函数
export const calculateModelPrice = ({
  record,
  selectedGroup,
  groupRatio,
  tokenUnit,
  displayPrice,
  currency,
  precision = 4,
}) => {
  // 1. 选择实际使用的分组
  let usedGroup = selectedGroup;
  let usedGroupRatio = groupRatio[selectedGroup];

  if (selectedGroup === 'all' || usedGroupRatio === undefined) {
    // 在模型可用分组中选择倍率最小的分组，若无则使用 1
    let minRatio = Number.POSITIVE_INFINITY;
    if (Array.isArray(record.enable_groups) && record.enable_groups.length > 0) {
      record.enable_groups.forEach((g) => {
        const r = groupRatio[g];
        if (r !== undefined && r < minRatio) {
          minRatio = r;
          usedGroup = g;
          usedGroupRatio = r;
        }
      });
    }

    // 如果找不到合适分组倍率，回退为 1
    if (usedGroupRatio === undefined) {
      usedGroupRatio = 1;
    }
  }

  // 2. 根据计费类型计算价格
  if (record.quota_type === 0) {
    // 按量计费
    const inputRatioPriceUSD = record.model_ratio * 2 * usedGroupRatio;
    const completionRatioPriceUSD = record.model_ratio * record.completion_ratio * 2 * usedGroupRatio;

    const unitDivisor = tokenUnit === 'K' ? 1000 : 1;
    const unitLabel = tokenUnit === 'K' ? 'K' : 'M';

    const rawDisplayInput = displayPrice(inputRatioPriceUSD);
    const rawDisplayCompletion = displayPrice(completionRatioPriceUSD);

    const numInput = parseFloat(rawDisplayInput.replace(/[^0-9.]/g, '')) / unitDivisor;
    const numCompletion = parseFloat(rawDisplayCompletion.replace(/[^0-9.]/g, '')) / unitDivisor;

    return {
      inputPrice: `${currency === 'CNY' ? '¥' : '$'}${numInput.toFixed(precision)}`,
      completionPrice: `${currency === 'CNY' ? '¥' : '$'}${numCompletion.toFixed(precision)}`,
      unitLabel,
      isPerToken: true,
      usedGroup,
      usedGroupRatio,
    };
  }

  if (record.quota_type === 1) {
    // 按次计费
    const priceUSD = parseFloat(record.model_price) * usedGroupRatio;
    const displayVal = displayPrice(priceUSD);

    return {
      price: displayVal,
      isPerToken: false,
      usedGroup,
      usedGroupRatio,
    };
  }

  // 未知计费类型，返回占位信息
  return {
    price: '-',
    isPerToken: false,
    usedGroup,
    usedGroupRatio,
  };
};

// 格式化价格信息（用于卡片视图）
export const formatPriceInfo = (priceData, t) => {
  const groupTag = priceData.usedGroup ? (
    <span style={{ color: 'var(--semi-color-text-1)' }} className="ml-1 text-xs">
      {t('分组')} {priceData.usedGroup}
    </span>
  ) : null;

  if (priceData.isPerToken) {
    return (
      <>
        <span style={{ color: 'var(--semi-color-text-1)' }}>
          {t('提示')} {priceData.inputPrice}/{priceData.unitLabel}
        </span>
        <span style={{ color: 'var(--semi-color-text-1)' }}>
          {t('补全')} {priceData.completionPrice}/{priceData.unitLabel}
        </span>
        {groupTag}
      </>
    );
  }

  return (
    <>
      <span style={{ color: 'var(--semi-color-text-1)' }}>
        {t('模型价格')} {priceData.price}
      </span>
      {groupTag}
    </>
  );
};

// -------------------------------
// CardPro 分页配置函数
// 用于创建 CardPro 的 paginationArea 配置
export const createCardProPagination = ({
  currentPage,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  isMobile = false,
  pageSizeOpts = [10, 20, 50, 100],
  showSizeChanger = true,
  t = (key) => key,
}) => {
  if (!total || total <= 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  const totalText = `${t('显示第')} ${start} ${t('条 - 第')} ${end} ${t('条，共')} ${total} ${t('条')}`;

  return (
    <>
      {/* 桌面端左侧总数信息 */}
      {!isMobile && (
        <span
          className="text-sm select-none"
          style={{ color: 'var(--semi-color-text-2)' }}
        >
          {totalText}
        </span>
      )}

      {/* 右侧分页控件 */}
      <Pagination
        currentPage={currentPage}
        pageSize={pageSize}
        total={total}
        pageSizeOpts={pageSizeOpts}
        showSizeChanger={showSizeChanger}
        onPageSizeChange={onPageSizeChange}
        onPageChange={onPageChange}
        size={isMobile ? "small" : "default"}
        showQuickJumper={isMobile}
        showTotal
      />
    </>
  );
};

// 模型定价筛选条件默认值
const DEFAULT_PRICING_FILTERS = {
  search: '',
  showWithRecharge: false,
  currency: 'USD',
  showRatio: false,
  viewMode: 'card',
  tokenUnit: 'M',
  filterGroup: 'all',
  filterQuotaType: 'all',
  filterEndpointType: 'all',
  filterVendor: 'all',
  filterTag: 'all',
  currentPage: 1,
};

// 重置模型定价筛选条件
export const resetPricingFilters = ({
  handleChange,
  setShowWithRecharge,
  setCurrency,
  setShowRatio,
  setViewMode,
  setFilterGroup,
  setFilterQuotaType,
  setFilterEndpointType,
  setFilterVendor,
  setFilterTag,
  setCurrentPage,
  setTokenUnit,
}) => {
  handleChange?.(DEFAULT_PRICING_FILTERS.search);
  setShowWithRecharge?.(DEFAULT_PRICING_FILTERS.showWithRecharge);
  setCurrency?.(DEFAULT_PRICING_FILTERS.currency);
  setShowRatio?.(DEFAULT_PRICING_FILTERS.showRatio);
  setViewMode?.(DEFAULT_PRICING_FILTERS.viewMode);
  setTokenUnit?.(DEFAULT_PRICING_FILTERS.tokenUnit);
  setFilterGroup?.(DEFAULT_PRICING_FILTERS.filterGroup);
  setFilterQuotaType?.(DEFAULT_PRICING_FILTERS.filterQuotaType);
  setFilterEndpointType?.(DEFAULT_PRICING_FILTERS.filterEndpointType);
  setFilterVendor?.(DEFAULT_PRICING_FILTERS.filterVendor);
  setFilterTag?.(DEFAULT_PRICING_FILTERS.filterTag);
  setCurrentPage?.(DEFAULT_PRICING_FILTERS.currentPage);
};
