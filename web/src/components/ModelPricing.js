import React, { useContext, useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { API, copy, showError, showInfo, showSuccess } from '../helpers';
import { useTranslation } from 'react-i18next';
import BubbleText from "./BubbleText.js";
import { SparklesIcon, FaceSmileIcon } from '@heroicons/react/24/solid';
// 新增CSS样式定义
const tableStyles = `
  .responsive-table .semi-table-row {
    transition: all 0.2s ease-in-out;
  }
  
  .responsive-table .semi-table-row:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.03), 0 1px 2px -1px rgba(0, 0, 0, 0.02);
  }
  
  .responsive-table .semi-table-thead .semi-table-row:hover {
    transform: none;
    box-shadow: none;
  }
  
  /* 修复Select组件样式 */
  .group-select .semi-select-selection {
    padding: 0;
    overflow: hidden;
  }
  
  .group-select .semi-select-content-wrapper {
    width: 100%;
    height: 100%;
  }
  
  .group-select .semi-select-selection-text {
    width: 100%;
    height: 100%;
    padding: 0;
  }
  
  @media (max-width: 768px) {
    /* 强制表格容器不可滚动 */
    .mobile-table-container {
      overflow-x: hidden !important;
      max-width: 100% !important;
    }
    
    /* 强制表格宽度适应容器 */
    .responsive-table {
      width: 100% !important;
      overflow: hidden !important;
    }
    
    /* 表格内容区域强制不滚动 */
    .responsive-table .semi-table-body {
      overflow-x: hidden !important;
      width: 100% !important;
    }
    
    /* 表格行强制换行 */
    .responsive-table .semi-table-tbody .semi-table-row {
      display: flex !important;
      flex-direction: column !important;
      border-bottom: 1px solid var(--semi-color-border);
      padding: 8px 0;
      margin-bottom: 12px;
      border-radius: 8px;
      background-color: var(--semi-color-bg-0) !important;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
      width: 100% !important;
      max-width: 100% !important;
    }
    
    /* 单元格强制不换行，占满整行 */
    .responsive-table .semi-table-tbody .semi-table-row .semi-table-cell {
      display: flex !important;
      flex-wrap: wrap !important;
      padding: 8px 12px;
      border: none;
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box;
      align-items: center;
      min-width: 0 !important;
    }
    
    .responsive-table .semi-table-tbody .semi-table-row .semi-table-cell::before {
      content: attr(data-column);
      font-weight: 500;
      color: var(--semi-color-text-2);
      width: 90px;
      min-width: 90px;
      flex-shrink: 0;
    }
    
    /* 隐藏表头 */
    .responsive-table .semi-table-header {
      display: none !important;
    }
    
    /* 移动端不需要左右阴影指示器 */
    .scroll-indicator {
      display: none !important;
    }
    
    /* 优化移动端卡片外观 */
    .responsive-table .semi-table-tbody .semi-table-row {
      background: var(--semi-color-bg-0);
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
      overflow: hidden;
      transition: all 0.3s;
    }
    
    /* 移动端的选择框位置调整 */
    .responsive-table .semi-table-tbody .semi-table-row .semi-table-row-cell:first-child {
      position: absolute;
      right: 10px;
      top: 10px;
      background: var(--semi-color-bg-0);
      border-radius: 50%;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
    }
    
    /* 移动端优化表格分页器 */
    .responsive-table .semi-table-pagination {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    
    /* 强制所有单元格适应宽度，无视min-width设置 */
    .responsive-table .semi-table-tbody .semi-table-row .semi-table-cell > div {
      max-width: 100% !important;
      width: 100% !important;
      min-width: 0 !important;
    }
    
    /* 确保表格内所有元素不产生水平滚动 */
    .responsive-table, 
    .responsive-table * {
      max-width: 100vw !important;
      overflow-x: hidden !important;
    }
    
    /* 去除semi-ui默认的水平滚动 */
    .responsive-table .semi-table-wrapper,
    .responsive-table .semi-table-container,
    .responsive-table .semi-table-body {
      overflow-x: hidden !important;
    }
  }
`;

import {
  Banner,
  Input,
  Layout,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Popover,
  ImagePreview,
  Button,
  Card,
  Select,
  Avatar,
} from '@douyinfe/semi-ui';
import {
  IconStar,
  IconTerminal,
  IconMore,
  IconVerify,
  IconClose,
  IconUploadError,
  IconHelpCircle,
  IconFilter,
  IconChevronLeft,
  IconChevronRight,
  IconPlay,
} from '@douyinfe/semi-icons';
import { UserContext } from '../context/User/index.js';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import '../pages/Home/HomeStyles.css';
import {useDispatch, useSelector} from "react-redux";
import {fetchModelDiscriptions, fetchProviders} from "../store/setting/providers.js";
import ApiGuideDrawer from "./ApiGuideDrawer.js";
import QuickChatModal from "./QuickChatModal.js";

// 定义一些实用类
const styles = {
  mb4: {
    marginBottom: '1rem'
  },
  priceValue: {
    color: 'var(--semi-color-text-0)',
    fontWeight: 600
  }
};

const ModelPricing = ({onInitialize}) => {
  const { t } = useTranslation();

  // 添加前缀分组定义
  const prefixGroups = {
    'discount:': { name: '折扣', description: '限时的折扣特价分组，稳定性和混合分组相当，推荐用于大多数常规业务' },
    'azure:': { name: 'Azure特价渠道', description: '具备很大性价比，但可能存在稳定性波动' },
    'mix:': { name: '混合分组', description: '综合性价比与性能，推荐用于大多数常规业务' },
    'reverse:': { name: '逆向渠道', description: '价格极低，但稳定性和可用性相对较差，适合非关键场景' },
    'official:': { name: '官方正价渠道', description: '官方正价，提供最优稳定性与可靠性，适用于生产环境或高要求任务。' }
  };

  // 获取模型的前缀分组
  const getModelPrefixGroup = useCallback((modelName) => {
    for (const prefix in prefixGroups) {
      if (prefix !== 'default' && modelName.startsWith(prefix)) {
        return prefix;
      }
    }
    return 'default';
  }, []);

  // 创建含有翻译的样式
  const getMobileStyles = () => `
    /* 模型名称在移动端特别处理，让它显示更突出 */
    .responsive-table .semi-table-tbody .semi-table-row .semi-table-cell[data-column="${t('模型名称')}"] {
      background-color: var(--semi-color-bg-0);
      border-radius: 4px 4px 0 0;
      margin-top: -8px;
      padding-top: 16px;
      font-weight: bold;
    }
    
    /* 模型价格在移动端底部显示，更明显 */
    .responsive-table .semi-table-tbody .semi-table-row .semi-table-cell[data-column="${t('模型价格')}"] {
      background-color: var(--semi-color-primary-light-default);
      opacity: 0.4;
      border-radius: 0 0 4px 4px;
      margin-bottom: -8px;
      padding-bottom: 16px;
    }
  `;

  const [filteredValue, setFilteredValue] = useState([]);
  const compositionRef = useRef({ isComposition: false });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [modalImageUrl, setModalImageUrl] = useState('');
  const [isModalOpenurl, setIsModalOpenurl] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('default');
  const [selectedProvider, setSelectedProvider] = useState('全部');
  const [groupOptions, setGroupOptions] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userState, userDispatch] = useContext(UserContext);
  const [groupRatio, setGroupRatio] = useState({});
  const [usableGroup, setUsableGroup] = useState({});
  const [showRatioColumn, setShowRatioColumn] = useState(false);
  const [showOnlySelectedGroup, setShowOnlySelectedGroup] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [activePage, setActivePage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [apiDrawerVisible, setApiDrawerVisible] = useState(false);
  const [currencyType, setCurrencyType] = useState('CNY'); // 新增货币类型状态
  const [chatVisible, setChatVisible] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');

  // 检测是否为移动设备
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // 初始检测
    checkIfMobile();

    // 监听窗口大小变化
    window.addEventListener('resize', checkIfMobile);

    // 清理监听器
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // 在 ModelPricing.js 中修改 useEffect 钩子
  useEffect(() => {
    if (onInitialize) {
      onInitialize({
        setSelectedProvider: (providerName) => {
          setSelectedProvider(providerName);
          setActivePage(1); // 重置页码为第一页

          // 添加滚动逻辑
          setTimeout(() => {
            if (providerScrollRef.current) {
              const providerItems = providerScrollRef.current.querySelectorAll('.provider-item');
              for (let i = 0; i < providerItems.length; i++) {
                if (providerItems[i].textContent.includes(providerName)) {
                  const containerWidth = providerScrollRef.current.clientWidth;
                  const elementOffset = providerItems[i].offsetLeft;
                  providerScrollRef.current.scrollTo({
                    left: elementOffset - containerWidth / 2 + providerItems[i].offsetWidth / 2,
                    behavior: 'smooth'
                  });
                  break;
                }
              }
            }
          }, 100);
        }
      });
    }
  }, [onInitialize]);

  // AI供应商数据
  const dispatch = useDispatch();
  const { providers = [],priceRatio=0} = useSelector((state) => state.providers);



  useEffect(() => {
    if (providers.length === 0) {
      dispatch(fetchProviders());
      // dispatch(fetchModelDiscriptions());
    }
  }, [dispatch]);

  // 根据模型名称判断供应商
  const getProviderFromModelName = useCallback((modelId) => {
    modelId = modelId.toLowerCase();

    // 第一轮：精确匹配，优先匹配完全相同的项目
    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      if (provider.includes && provider.includes.some((item) => item.toLowerCase() === modelId)) {
        return provider.id;
      }
    }

    // 第二轮：模糊匹配，匹配包含关系
    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      if (modelId.includes(provider.id.toLowerCase())) {
        return provider.id;
      }
      // 判断provider.includes是否非空，并且是否包含
      if (provider.includes && provider.includes.some((item) => modelId.includes(item.toLowerCase()))) {
        return provider.id;
      }
    }
    return '其他';
  }, [providers]);

  // 供应商导航栏滚动功能
  const providerScrollRef = useRef(null);
  const [showLeftScroll, setShowLeftScroll] = useState(true);
  const [showRightScroll, setShowRightScroll] = useState(true);


  // 滚动处理函数
  const handleScroll = useCallback((direction) => {
    if (providerScrollRef.current) {
      const scrollAmount = 300; // 每次滚动的像素量
      const currentScroll = providerScrollRef.current.scrollLeft;
      providerScrollRef.current.scrollTo({
        left: direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount,
        behavior: 'smooth'
      });

    }
  }, []);

  // 将copyText函数移到这里，在columns之前定义
  const copyText = useCallback(async (text) => {
    if (await copy(text)) {
      showSuccess('已复制：' + text);
    } else {
      // setSearchKeyword(text);
      Modal.error({ title: '无法复制到剪贴板，请手动复制', content: text });
    }
  }, []);

  // 过滤显示的模型
  const filteredModels = useMemo(() => {
    if (!models || models.length === 0) return [];

    return models.filter(model => {
      // 如果选择了"全部"，不进行分组过滤
      if (selectedGroup === 'all') {
        // 只检查供应商筛选条件
      } else {
        // 检查是否匹配前缀分组或enable_groups
        const modelPrefixGroup = getModelPrefixGroup(model.model_name);
        const hasEnableGroup = model.enable_groups.includes(selectedGroup);

        // 如果开启了仅显示当前分组
        if (showOnlySelectedGroup) {
          // 必须匹配前缀分组或在enable_groups中
          if (modelPrefixGroup !== selectedGroup && !hasEnableGroup) {
            return false;
          }
        } else {
          // 如果选择的是前缀分组，按前缀过滤
          if (Object.keys(prefixGroups).includes(selectedGroup)) {
            if (modelPrefixGroup !== selectedGroup) {
              return false;
            }
          } else {
            // 如果选择的是enable_groups中的分组，按enable_groups过滤
            if (!hasEnableGroup) {
              return false;
            }
          }
        }
      }

      // 然后检查是否匹配供应商筛选条件
      if (selectedProvider !== '全部') {
        const provider = getProviderFromModelName(model.model_name);

        // 如果选择了"其他"供应商，则显示所有不属于已定义供应商的模型
        if (selectedProvider === '其他') {
          return provider === '其他';
        }

        // 否则显示匹配选定供应商的模型
        return provider === selectedProvider;
      }

      // 如果是全部供应商，则显示
      return true;
    });
  }, [models, selectedProvider, selectedGroup, showOnlySelectedGroup, getProviderFromModelName, getModelPrefixGroup]);

  // 计算每个供应商的模型数量
  const providerCounts = useMemo(() => {
    if (!models || models.length === 0) return {};

    // 首先过滤掉不包含当前所选前缀分组的模型
    const modelsInSelectedGroup = models.filter(model => {
      // 获取模型的前缀分组
      const modelPrefixGroup = getModelPrefixGroup(model.model_name);

      // 如果选择了"全部"，不进行前缀分组过滤
      if (selectedGroup === 'all') {
        return true;
      } else if (selectedGroup !== 'default' || showOnlySelectedGroup) {
        // 如果选择了非default分组，或者开启了仅显示当前分组，则按前缀分组过滤
        if (modelPrefixGroup !== selectedGroup) {
          return false;
        }
      }

      return true;
    });

    const counts = { '全部': modelsInSelectedGroup.length };
    modelsInSelectedGroup.forEach(model => {
      const provider = getProviderFromModelName(model.model_name);
      counts[provider] = (counts[provider] || 0) + 1;
    });

    return counts;
  }, [models, selectedGroup, showOnlySelectedGroup, getProviderFromModelName, getModelPrefixGroup]);

  const rowSelection = useMemo(
      () => ({
        onChange: (selectedRowKeys, selectedRows) => {
          setSelectedRowKeys(selectedRowKeys);
        },
      }),
      []
  );

  const handleChange = (value) => {
    if (compositionRef.current.isComposition) {
      return;
    }
    const newFilteredValue = value ? [value] : [];
    setFilteredValue(newFilteredValue);
    setActivePage(1); // 重置页码为第一页
  };
  const handleCompositionStart = () => {
    compositionRef.current.isComposition = true;
  };

  const handleCompositionEnd = (event) => {
    compositionRef.current.isComposition = false;
    const value = event.target.value;
    const newFilteredValue = value ? [value] : [];
    setFilteredValue(newFilteredValue);
    setActivePage(1); // 重置页码为第一页
  };

  function renderQuotaType(type) {
    switch (type) {
      case 1:
        return (
            <BubbleText
                bubbleText={t('按次计费')}
                background="linear-gradient(to right, var(--semi-color-warning-light-default), var(--semi-color-warning-light-hover))"
                color="var(--semi-color-warning)"
                borderColor="var(--semi-color-warning-light-active)"
                borderWidth="1px"
                borderStyle="solid"
                svg={
                  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4V20M18 12H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
            />
        );
      case 0:
        return (
            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                 style={{
                   background: 'linear-gradient(to right, var(--semi-color-primary-light-default), var(--semi-color-primary-light-hover))',
                   color: 'var(--semi-color-primary)',
                   borderColor: 'var(--semi-color-primary-light-active)',
                   borderWidth: '1px',
                   borderStyle: 'solid'
                 }}>
          <span className="flex items-center">
            <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('按量计费')}
          </span>
            </div>
        );
      default:
        return (
            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                 style={{
                   background: 'linear-gradient(to right, var(--semi-color-fill-0), var(--semi-color-fill-1))',
                   color: 'var(--semi-color-text-1)',
                   borderColor: 'var(--semi-color-border)',
                   borderWidth: '1px',
                   borderStyle: 'solid'
                 }}>
          <span className="flex items-center">
            <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 16V12M12 8H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('未知')}
          </span>
            </div>
        );
    }
  }

  function renderAvailable(available) {
    return (
        <Popover
            content={
              <div className="py-2 px-3">
                {available
                    ? t('当前分组可用')
                    : t('当前分组不可用')}
              </div>
            }
            position='top'
            style={{
              backgroundColor: 'var(--semi-color-bg-2)',
              borderColor: 'var(--semi-color-border)',
              color: 'var(--semi-color-text-0)',
              borderWidth: 1,
              borderStyle: 'solid',
            }}
        >

          <div className="flex items-center justify-center py-1 px-2 rounded-md whitespace-nowrap"
               style={{
                 backgroundColor: 'var(--semi-color-success)',
                 borderColor: 'var(--semi-color-success-active)',
                 borderWidth: '1px',
                 borderStyle: 'solid'
               }}>
            <IconVerify size="small" style={{ color: 'white' }} className="flex-shrink-0" />
            <span className="ml-1 text-xs font-bold"
                  style={{ color: 'white' }}>
            {t('当前分组可用')}
          </span>
          </div>
        </Popover>
    );
  }

  // 添加一个函数来根据分组名称获取固定颜色
  const getGroupColor = useCallback((groupName) => {
    // 使用分组名称的哈希值来确定颜色
    const stringToHash = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash);
    };

    const colors = [
      { bg: 'bg-slate-600 text-white',    unselected: 'bg-slate-100 text-slate-800' },
      { bg: 'bg-stone-600 text-white',    unselected: 'bg-stone-100 text-stone-800' },
      { bg: 'bg-gray-600 text-white',     unselected: 'bg-gray-100 text-gray-800' },
      { bg: 'bg-zinc-600 text-white',     unselected: 'bg-zinc-100 text-zinc-800' },
      { bg: 'bg-neutral-600 text-white',  unselected: 'bg-neutral-100 text-neutral-800' },
      { bg: 'bg-pink-600 text-white',     unselected: 'bg-pink-100 text-pink-800' },
      { bg: 'bg-rose-600 text-white',     unselected: 'bg-rose-100 text-rose-800' },
      { bg: 'bg-fuchsia-600 text-white',  unselected: 'bg-fuchsia-100 text-fuchsia-800' },
      { bg: 'bg-violet-600 text-white',   unselected: 'bg-violet-100 text-violet-800' },
      { bg: 'bg-sky-600 text-white',      unselected: 'bg-sky-100 text-sky-800' },
      { bg: 'bg-teal-600 text-white',     unselected: 'bg-teal-100 text-teal-800' },
      { bg: 'bg-lime-600 text-white',     unselected: 'bg-lime-100 text-lime-800' },
    ];

    const index = stringToHash(groupName) % colors.length;
    return colors[index];
  }, []);

  const columns = useMemo(() => {
    const baseColumns = [
      {
        title: t('可用性'),
        dataIndex: 'available',
        render: (text, record, index) => {
          // 判断支持的分组有没有所选分组
          let available = false;
          if (selectedGroup === 'all' || record.enable_groups.includes(selectedGroup)) {
            available = true;
          }
          return renderAvailable(available);
        },
        sorter: (a, b) => a.available - b.available,
        className: 'min-w-[80px]',
        onCell: () => ({
          'data-column': t('可用性')
        }),
        width: '7%',
      },
      {
        title: t('模型名称'),
        dataIndex: 'model_name',
        render: (text, record, index) => {
          return (
              <>
                <div
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer whitespace-nowrap max-w-full overflow-hidden"
                    style={{
                      background: 'linear-gradient(to right, var(--semi-color-primary-light-default), var(--semi-color-primary-light-hover))',
                      color: 'var(--semi-color-primary)',
                      borderColor: 'var(--semi-color-primary-light-active)',
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}
                    onClick={() => copyText(text)}
                    title={text}
                >
                  <span className="truncate">{text}</span>
                </div>
              </>
          );
        },
        onFilter: (value, record) =>
            record.model_name.toLowerCase().includes(value.toLowerCase()),
        filteredValue,
        className: 'min-w-[120px]',
        onCell: () => ({
          'data-column': t('模型名称')
        }),
        width: '13%',
      },
      {
        title: t('计费类型'),
        dataIndex: 'quota_type',
        render: (text, record, index) => {
          return renderQuotaType(parseInt(text));
        },
        sorter: (a, b) => a.quota_type - b.quota_type,
        className: 'min-w-[120px]',
        onCell: () => ({
          'data-column': t('计费类型')
        }),
        width: '15%',
      },
      {
        title: t('可用分组'),
        dataIndex: 'enable_groups',
        render: (text, record, index) => {
          return (
              <div className="flex flex-wrap gap-1.5">
                {text.map((group) => {
                  if (usableGroup[group]) {
                    const colorStyle = getGroupColor(group);

                    if (group === selectedGroup) {
                      return (
                          <div key={group} className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${colorStyle.bg} shadow-md`} style={{ borderWidth: '0px', borderStyle: 'solid' }}>
                            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
                            </svg>
                            {group}
                          </div>
                      );
                    } else {
                      return (
                          <div
                              key={group}
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorStyle.unselected} cursor-pointer hover:opacity-100 transition-opacity opacity-100 shadow-sm`}
                              onClick={() => {
                                // setSelectedGroup(group);
                                // setActivePage(1); // 重置页码为第一页
                                // showInfo(t('当前查看的分组为：{{group}}', {
                                //   group: group
                                // }));
                              }}
                          >
                            {group}
                          </div>
                      );
                    }
                  }
                  return null;
                })}
              </div>
          );
        },
        className: 'min-w-[150px]',
        onCell: () => ({
          'data-column': t('可用分组')
        }),
        width: '25%',
      },
    ];

    // 如果显示倍率列，则添加倍率列
    if (showRatioColumn) {
      baseColumns.push({
        title: () => (
            <span className="flex items-center gap-1">
            {t('倍率')}
              <Popover
                  content={
                    <div style={{ padding: 8 }}>
                      {t('倍率是为了方便换算不同价格的模型')}<br/>
                      {t('点击查看倍率说明')}
                    </div>
                  }
                  position='top'
                  style={{
                    backgroundColor: 'var(--semi-color-bg-2)',
                    borderColor: 'var(--semi-color-border)',
                    color: 'var(--semi-color-text-0)',
                    borderWidth: 1,
                    borderStyle: 'solid',
                  }}
              >
              <IconHelpCircle
                  onClick={() => {
                    setModalImageUrl('/ratio.png');
                    setIsModalOpenurl(true);
                  }}
                  className="cursor-pointer"
              />
            </Popover>
          </span>
        ),
        dataIndex: 'model_ratio',
        render: (text, record, index) => {
          let content = text;
          let completionRatio = parseFloat(record.completion_ratio.toFixed(3));
          content = (
              <div className="text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--semi-color-text-2)' }}>{t('模型')}：</span>
                  <span className="font-medium" style={{ color: 'var(--semi-color-text-0)' }}>{record.quota_type === 0 ? (typeof text === 'number' ? text.toFixed(3) : text) : t('无')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--semi-color-text-2)' }}>{t('补全')}：</span>
                  <span className="font-medium" style={{ color: 'var(--semi-color-text-0)' }}>{record.quota_type === 0 ? completionRatio : t('无')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--semi-color-text-2)' }}>{t('分组')}：</span>
                  <span className="font-medium" style={{ color: 'var(--semi-color-text-0)' }}>{typeof groupRatio[selectedGroup] === 'number' ? Number(groupRatio[selectedGroup]).toFixed(3) : 1}</span>
                </div>
              </div>
          );
          return <div className="min-w-[50px]">{content}</div>;
        },
        className: 'min-w-[50px]',
        onCell: () => ({
          'data-column': t('倍率')
        }),
        width: '15%',
      });
    }

// 添加模型价格列
    baseColumns.push({
      title: () => (
          <div className="flex items-center gap-1 whitespace-nowrap">
            <span className="flex-shrink-0">{t('模型价格')}</span>
          </div>
      ),
      dataIndex: 'model_price',
      render: (text, record, index) => {
        let content = text;
        const currencySymbol = currencyType === 'USD' ? '$' : '￥';
        // 使用固定倍率1，因为现在只有default分组
        const currentGroupRatio = 1;

        if (record.quota_type === 0) {
          // 这里的 *2 是因为 1倍率=0.002刀，请勿删除
          const inputRatioPrice = (record.model_ratio * 2 * currentGroupRatio).toFixed(2);
          const completionRatioPrice = (record.model_ratio * record.completion_ratio * 2 * currentGroupRatio).toFixed(2);

          content = (
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between rounded-md px-2 py-1" style={{
                  backgroundColor: 'var(--semi-color-primary-light-default)',
                  color: 'var(--semi-color-primary)'
                }}>
                  <div className="flex items-center space-x-1 font-medium" style={{ color: 'var(--semi-color-primary)' }}>
                    <SparklesIcon className="w-5 h-5" />
                    <span>{t('提示')}:</span>
                  </div>
                  <span className="font-medium" style={{ color: 'var(--semi-color-primary)' }}>
                    {currencySymbol}
                    {currencyType === 'CNY'
                        ? (parseFloat(inputRatioPrice) ).toFixed(2)
                        : (parseFloat(inputRatioPrice)).toFixed(2)} / 1M
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md px-2 py-1" style={{
                  backgroundColor: 'var(--semi-color-success-light-default)',
                  color: 'var(--semi-color-success)'
                }}>
                  <div className="flex items-center space-x-1 font-medium" style={{ color: 'var(--semi-color-success)' }}>
                    <FaceSmileIcon className="w-5 h-5" />
                    <span>{t('补全')}:</span>
                  </div>
                  <span className="font-medium" style={{ color: 'var(--semi-color-success)' }}>
                    {currencySymbol}
                    {currencyType === 'CNY'
                        ? (parseFloat(completionRatioPrice) ).toFixed(2)
                        : (parseFloat(completionRatioPrice)).toFixed(2)} / 1M
                  </span>
                </div>
              </div>
          );
        } else {
          const price = (parseFloat(text) * currentGroupRatio).toFixed(2);
          content = (
              <BubbleText
                  bubbleText={`${currencyType === 'USD' ? '$' : '￥'} ${currencyType === 'CNY'
                      ? (parseFloat(price) * priceRatio).toFixed(2)
                      : price} / ${t('次')}`}
                  background="linear-gradient(to right, var(--semi-color-warning-light-default), var(--semi-color-warning-light-hover))"
                  color="var(--semi-color-warning)"
                  borderColor="var(--semi-color-warning-light-active)"
                  borderWidth="1px"
                  borderStyle="solid"
                  svg={
                    <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7.5 10.5L10.5 13.5L16.5 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  }
              />
          );
        }

        return <div className="model-price-cell min-w-[150px]">{content}</div>;
      },
      className: 'min-w-[100px]',
      onCell: () => ({
        'data-column': t('模型价格')
      }),
      width: '15%',
    });

    baseColumns.push(
        {
          title: t('模型描述'),
          dataIndex: 'model_description',
          render: (text, record, index) => {
            return (
              <div className="flex flex-col gap-2">
                <Tooltip content={text} position="top">
                  <div className="inline-flex items-start px-2.5 py-1.5 leading-5 max-w-full" style={{ fontSize: '12px', color: 'var(--semi-color-text-2)' }}>
                    <div className="line-clamp-4 min-h-[5em]">
                      {text}
                    </div>
                  </div>
                </Tooltip>
                <Button
                  theme="light"
                  type="primary"
                  size="small"
                  icon={<IconPlay />}
                  onClick={() => handleQuickTest(record.model_name)}
                  style={{
                    alignSelf: 'flex-start',
                    fontSize: '12px',
                    padding: '4px 8px',
                    height: '28px'
                  }}
                >
                  {t('立即体验')}
                </Button>
              </div>
            );
          },
          className: 'min-w-[200px]',
          onCell: () => ({
            'data-column': t('模型描述')
          }),
          width: '20%',
        }
    )

    return baseColumns;
  }, [t, selectedGroup, groupRatio, filteredValue, usableGroup, showRatioColumn, currencyType]);

  const setModelsFormat = useCallback((models, groupRatio) => {
    // 为每个模型添加必要的属性
    for (let i = 0; i < models.length; i++) {
      models[i].key = models[i].model_name;
      models[i].group_ratio = groupRatio[models[i].model_name];
    }

    // 创建供应商优先级映射（按 providers 数组顺序）
    const providerPriorityMap = new Map();
    providers.forEach((provider, index) => {
      providerPriorityMap.set(provider.id, index);
    });

    // 创建模型名称到 includes 中位置的映射，用于优化查找性能
    const modelPositionMap = new Map();

    // 遍历所有 providers 的 includes，记录每个模型在 includes 中的位置
    providers.forEach(provider => {
      if (provider.includes && Array.isArray(provider.includes)) {
        provider.includes.forEach((modelName, index) => {
          const lowerModelName = modelName.toLowerCase();
          // 如果该模型还没有记录位置，或者当前位置更靠前，则更新位置
          if (!modelPositionMap.has(lowerModelName) || modelPositionMap.get(lowerModelName) > index) {
            modelPositionMap.set(lowerModelName, index);
          }
        });
      }
    });

    // 高效的排序函数
    models.sort((a, b) => {
      // 首先按计费类型排序（按量计费在前）
      if (a.quota_type !== b.quota_type) {
        return a.quota_type - b.quota_type;
      }

      // 获取每个模型所属的供应商
      const aProvider = getProviderFromModelName(a.model_name);
      const bProvider = getProviderFromModelName(b.model_name);

      // 获取供应商优先级
      const aPriority = providerPriorityMap.get(aProvider) ?? 999; // 未知供应商排在最后
      const bPriority = providerPriorityMap.get(bProvider) ?? 999;

      // 按供应商优先级排序
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // 同一供应商内部，按 includes 顺序排序
      const aModelName = a.model_name.toLowerCase();
      const bModelName = b.model_name.toLowerCase();

      const aIncludesPosition = modelPositionMap.get(aModelName);
      const bIncludesPosition = modelPositionMap.get(bModelName);

      // 如果两个模型都在 includes 中
      if (aIncludesPosition !== undefined && bIncludesPosition !== undefined) {
        return aIncludesPosition - bIncludesPosition;
      }

      // 如果只有 a 在 includes 中，a 排在前面
      if (aIncludesPosition !== undefined && bIncludesPosition === undefined) {
        return -1;
      }

      // 如果只有 b 在 includes 中，b 排在前面
      if (aIncludesPosition === undefined && bIncludesPosition !== undefined) {
        return 1;
      }

      // 如果都不在 includes 中，按字典序排序
      return a.model_name.localeCompare(b.model_name);
    });

    setModels(models);
  }, [providers, getProviderFromModelName]);

  // 点击快速接入按钮
  const handleQuickAccess = () => {
    setApiDrawerVisible(true);
  };

  const loadPricing = useCallback(async () => {
    setLoading(true);

    let url = '';
    url = `/api/pricing`;
    try {
      const res = await API.get(url);
      const { success, message, data, group_ratio, usable_group } = res.data;
      if (success) {
        // usable_group 去除default
        const usableGroupFiltered = {};
        for (const group in usable_group) {
          if (group !== '') {
            usableGroupFiltered[group] = usable_group[group];
          }
        }

        setGroupRatio(group_ratio);
        setUsableGroup(usableGroupFiltered);
        setSelectedGroup('all')

        // 先设置原始模型数据（不排序）
        const formattedModels = data.map(model => ({
          ...model,
          key: model.model_name,
          group_ratio: group_ratio[model.model_name]
        }));
        setModels(formattedModels);

        // 加载前缀分组选项
        loadGroupOptions();
      } else {
        showError(message);
      }
    } catch (error) {
      showError('获取模型价格失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 当 providers 数据加载完成后，重新排序模型
  const modelsSortedRef = useRef(false);

  useEffect(() => {
    if (models.length > 0 && providers.length > 0 && !modelsSortedRef.current) {
      const sortedModels = [...models];

      // 创建供应商优先级映射（按 providers 数组顺序）
      const providerPriorityMap = new Map();
      providers.forEach((provider, index) => {
        providerPriorityMap.set(provider.id, index);
      });

      // 创建模型名称到 includes 中位置的映射，用于优化查找性能
      const modelPositionMap = new Map();

      // 遍历所有 providers 的 includes，记录每个模型在 includes 中的位置
      providers.forEach(provider => {
        if (provider.includes && Array.isArray(provider.includes)) {
          provider.includes.forEach((modelName, index) => {
            const lowerModelName = modelName.toLowerCase();
            // 如果该模型还没有记录位置，或者当前位置更靠前，则更新位置
            if (!modelPositionMap.has(lowerModelName) || modelPositionMap.get(lowerModelName) > index) {
              modelPositionMap.set(lowerModelName, index);
            }
          });
        }
      });

      // 高效的排序函数
      sortedModels.sort((a, b) => {
        // 首先按计费类型排序（按量计费在前）
        if (a.quota_type !== b.quota_type) {
          return a.quota_type - b.quota_type;
        }

        // 获取每个模型所属的供应商
        const aProvider = getProviderFromModelName(a.model_name);
        const bProvider = getProviderFromModelName(b.model_name);

        // 获取供应商优先级
        const aPriority = providerPriorityMap.get(aProvider) ?? 999; // 未知供应商排在最后
        const bPriority = providerPriorityMap.get(bProvider) ?? 999;

        // 按供应商优先级排序
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        // 同一供应商内部，按 includes 顺序排序
        const aModelName = a.model_name.toLowerCase();
        const bModelName = b.model_name.toLowerCase();

        const aIncludesPosition = modelPositionMap.get(aModelName);
        const bIncludesPosition = modelPositionMap.get(bModelName);

        // 如果两个模型都在 includes 中
        if (aIncludesPosition !== undefined && bIncludesPosition !== undefined) {
          return aIncludesPosition - bIncludesPosition;
        }

        // 如果只有 a 在 includes 中，a 排在前面
        if (aIncludesPosition !== undefined && bIncludesPosition === undefined) {
          return -1;
        }

        // 如果只有 b 在 includes 中，b 排在前面
        if (aIncludesPosition === undefined && bIncludesPosition !== undefined) {
          return 1;
        }

        // 如果都不在 includes 中，按字典序排序
        return a.model_name.localeCompare(b.model_name);
      });

      setModels(sortedModels);
      modelsSortedRef.current = true;
    }
  }, [providers.length, models.length, getProviderFromModelName]);

  // 重置排序标记当模型数据重新加载时
  useEffect(() => {
    if (models.length === 0) {
      modelsSortedRef.current = false;
    }
  }, [models.length]);

  const refresh = useCallback(async () => {
    await loadPricing();
  }, [loadPricing]);

  // 加载分组下拉框选项
  const loadGroupOptions = useCallback(() => {
    // 先添加"全部"选项
    const options = [
      {
        label: (
            <div className="group-option">
              <span>全部</span>
              <span className="group-ratio-badge" style={{ fontSize: '10px', color: 'var(--semi-color-text-2)' }}>
              显示所有模型
            </span>
            </div>
        ),
        value: 'all'
      }
    ];

    // 添加前缀分组选项，显示名称和描述，但排除default
    const prefixOptions = Object.keys(prefixGroups)
        .filter(prefix => prefix !== 'default')
        .map(prefix => ({
          label: (
              <div className="group-option">
                <span>{prefixGroups[prefix].name}</span>
                <span className="group-ratio-badge" style={{ fontSize: '10px', color: 'var(--semi-color-text-2)' }}>
              {prefixGroups[prefix].description}
            </span>
              </div>
          ),
          value: prefix
        }));

    options.push(...prefixOptions);
    setGroupOptions(options);
  }, []);

  // 处理分组变更
  const handleGroupChange = useCallback((value) => {
    setSelectedGroup(value);
    setActivePage(1); // 重置页码为第一页

    if (value === 'all') {
      showInfo(t('当前查看：全部分组'));
    } else {
      const groupInfo = prefixGroups[value];
      showInfo(t('当前查看的分组为：{{group}}', {
        group: groupInfo.name
      }));
    }
  }, [t]);


  // 当模型数据加载完成后重新检查
  useEffect(() => {
    // 直接加载前缀分组选项，不依赖模型数据
    loadGroupOptions();
  }, [loadGroupOptions]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 处理立即体验按钮点击
  const handleQuickTest = useCallback(async (modelName) => {
    try {
      // 检查用户是否有token
      const res = await API.get('/api/token');
      const { success, data } = res.data;
      
      if (!success || !data || data.length === 0) {
        Modal.warning({
          title: t('需要创建Token'),
          content: t('您还没有创建API Token，请先创建一个Token才能体验模型'),
          okText: t('去创建Token'),
          onOk: () => {
            window.location.href = '/token';
          }
        });
        return;
      }
      
      // 设置选中的模型并打开聊天窗口
      setSelectedModel(modelName);
      setChatVisible(true);
    } catch (error) {
      showError(t('检查Token失败，请稍后重试'));
    }
  }, [t]);

  return (
      <>

        {/* API接入指南抽屉 */}
        <ApiGuideDrawer
            visible={apiDrawerVisible}
            onClose={() => setApiDrawerVisible(false)}
            baseUrl=""
            modelId="gpt-4o"
        />

        {/* 快速聊天模态框 */}
        <QuickChatModal
          visible={chatVisible}
          onClose={() => setChatVisible(false)}
          modelName={selectedModel}
        />

        <Layout>
          {/* 添加内联样式 */}
          <style>{tableStyles}</style>
          <style>{getMobileStyles()}</style>
          <div className="model-pricing-section">
            <Card className="pricing-card">
              {/*<div className="mb-4">*/}
              {/*  <Banner*/}
              {/*      type="info"*/}
              {/*      fullMode={false}*/}
              {/*      description={<div>{t('本站模型换算汇率为：1美元 =') + priceRatio + t('人民币')}</div>}*/}
              {/*      closeIcon={null}*/}
              {/*  />*/}
              {/*</div>*/}

              <div className="mb-4">
                <Banner
                    type="info"
                    fullMode={false}
                    description={<div>{t('按量计费费用 = 分组倍率 × 模型倍率 × （提示token数 + 补全token数 × 补全倍率）/ 500000 ')}</div>}
                    closeIcon={null}
                />
              </div>

              {/* 供应商导航栏 */}
              <div className="provider-section mb-4">
                <div className="section-title">{t('按供应商过滤')}
                  <span style={{marginLeft: '10px'}}>

                  <Button theme="light" type="primary" size="default" onClick={handleQuickAccess}>
                    <div className="flex items-center">
                      <IconVerify style={{ fontSize: '20px', marginRight: '4px' }} />
                      快速接入
                    </div>
                </Button>
               </span>
                </div>
                <div className="provider-navbar" style={{ position: 'relative', paddingLeft: '12px', paddingRight: '12px' }}>
                  {showLeftScroll && (
                      <div className="relative group" style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
                        <button
                            className="provider-scroll-btn scroll-left"
                            aria-label="显示所有供应商"
                            onClick={() => handleScroll('left')}
                            style={{
                              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                              backgroundColor: 'var(--semi-color-bg-2)',
                              borderRadius: '50%',
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                        >
                          <IconChevronLeft size="large" />
                        </button>

                        {/* Dropdown that appears on hover */}
                        <div
                            className="
                          absolute left-0 top-full mt-2 w-64
                          bg-white bg-opacity-60 backdrop-blur-sm
                          border border-gray-200 rounded-xl shadow-lg
                          opacity-0 invisible group-hover:opacity-100 group-hover:visible
                          transition-opacity duration-200 ease-out
                          max-h-80    overflow-x-hidden overflow-y-auto
                          overscroll-contain scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent z-20
                          "
                        >
                          <div className="py-2 divide-y divide-gray-100">
                            {providers.map(provider => (
                                <div
                                    key={provider.id}
                                    className={`
                                    provider-item
                                    flex items-center px-4 py-3
                                    hover:bg-gray-50 cursor-pointer
                                    transition-colors duration-150
                                    ${selectedProvider === provider.id ? 'bg-blue-50' : ''}
                                    mb-1 border-b border-gray-100
                                  `}
                                    onClick={() => {
                                      setSelectedProvider(provider.id);
                                      setActivePage(1); // 重置页码为第一页
                                      // Close popover after selection
                                      document.body.click();
                                      // Scroll to the selected provider in the navigation bar
                                      setTimeout(() => {
                                        const providerElements = providerScrollRef.current.querySelectorAll('.provider-item');
                                        for (let i = 0; i < providerElements.length; i++) {
                                          if (providerElements[i].textContent.includes(provider.name)) {
                                            const containerWidth = providerScrollRef.current.clientWidth;
                                            const elementOffset = providerElements[i].offsetLeft;
                                            providerScrollRef.current.scrollTo({
                                              left: elementOffset - containerWidth / 2 + providerElements[i].offsetWidth / 2,
                                              behavior: 'smooth'
                                            });
                                            break;
                                          }
                                        }
                                      }, 100);
                                    }}
                                >
                                  <div className="flex-shrink-0 mr-3">
                                    {provider.icon ? (
                                        <img
                                            src={provider.icon}
                                            alt={provider.name}
                                            className="w-6 h-6 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                                          {provider.name.charAt(0)}
                                        </div>
                                    )}
                                  </div>
                                  <div className="flex-grow text-sm font-medium text-gray-700">
                                    {provider.name}
                                  </div>
                                  <div className="ml-auto bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                                    {providerCounts[provider.id] || 0}
                                  </div>
                                </div>
                            ))}
                          </div>
                        </div>
                      </div>
                  )}

                  <div
                      className="provider-scroll-container"
                      ref={providerScrollRef}
                      style={{ margin: '0 8px' }}
                  >
                    {providers.map(provider => (
                        <div
                            key={provider.id}
                            className={`provider-item ${selectedProvider === provider.id ? 'active' : ''}`}
                            onClick={(e) => {
                              e.preventDefault(); // 阻止默认行为
                              setSelectedProvider(provider.id);
                              setActivePage(1); // 重置页码为第一页
                            }}
                        >
                          <div className="provider-icon">
                            {provider.icon ? (
                                <Avatar
                                    src={provider.icon}
                                    size="small"
                                    alt={provider.name}
                                />
                            ) : (
                                <div className="provider-fallback-icon">{provider.name.charAt(0)}</div>
                            )}
                          </div>
                          <span className="provider-name">{provider.name}</span>
                          <span className="provider-count">{providerCounts[provider.id] || 0}</span>
                        </div>
                    ))}
                  </div>

                  {showRightScroll && (
                      <div className="relative group" style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
                        <button
                            className="provider-scroll-btn scroll-right"
                            aria-label="显示所有供应商"
                            onClick={() => handleScroll('right')}
                            style={{
                              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                              backgroundColor: 'var(--semi-color-bg-2)',
                              borderRadius: '50%',
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                        >
                          <IconChevronRight size="large" />
                        </button>

                        {/* Dropdown that appears on hover */}
                        <div
                            className="
                          absolute right-0 top-full mt-2 w-64
                          bg-white bg-opacity-60 backdrop-blur-sm
                          border border-gray-200 rounded-xl shadow-lg
                          opacity-0 invisible group-hover:opacity-100 group-hover:visible
                          transition-opacity duration-200 ease-out
                          max-h-80    overflow-x-hidden overflow-y-auto
                          overscroll-contain scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent z-20
                          "
                        >
                          <div className="py-2 divide-y divide-gray-100">
                            {providers.map(provider => (
                                <div
                                    key={provider.id}
                                    className={`
                                    provider-item
                                    flex items-center px-4 py-3
                                    hover:bg-gray-50 cursor-pointer
                                    transition-colors duration-150
                                    ${selectedProvider === provider.id ? 'bg-blue-50' : ''}
                                    mb-1 border-b border-gray-100
                                  `}
                                    onClick={() => {
                                      setSelectedProvider(provider.id);
                                      setActivePage(1); // 重置页码为第一页
                                      // Close popover after selection
                                      document.body.click();
                                      // Scroll to the selected provider in the navigation bar
                                      setTimeout(() => {
                                        const providerElements = providerScrollRef.current.querySelectorAll('.provider-item');
                                        for (let i = 0; i < providerElements.length; i++) {
                                          if (providerElements[i].textContent.includes(provider.name)) {
                                            const containerWidth = providerScrollRef.current.clientWidth;
                                            const elementOffset = providerElements[i].offsetLeft;
                                            providerScrollRef.current.scrollTo({
                                              left: elementOffset - containerWidth / 2 + providerElements[i].offsetWidth / 2,
                                              behavior: 'smooth'
                                            });
                                            break;
                                          }
                                        }
                                      }, 100);
                                    }}
                                >
                                  <div className="flex-shrink-0 mr-3">
                                    {provider.icon ? (
                                        <img
                                            src={provider.icon}
                                            alt={provider.name}
                                            className="w-6 h-6 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                                          {provider.name.charAt(0)}
                                        </div>
                                    )}
                                  </div>
                                  <div className="flex-grow text-sm font-medium text-gray-700">
                                    {provider.name}
                                  </div>
                                  <div className="ml-auto bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                                    {providerCounts[provider.id] || 0}
                                  </div>
                                </div>
                            ))}
                          </div>
                        </div>
                      </div>
                  )}
                </div>
              </div>

              <div className=" mb-4 flex items-center flex-wrap gap-2">
                <div className="search-section">
                  <Input
                      prefix={<IconHelpCircle size="small" />}
                      placeholder={t('模糊搜索模型名称')}
                      style={{ minWidth: 220 }}
                      onCompositionStart={handleCompositionStart}
                      onCompositionEnd={handleCompositionEnd}
                      onChange={handleChange}
                      showClear
                  />
                </div>

                <div className="group-selector flex items-center gap-2">
                  <Select
                      prefix={<IconFilter size="small" />}
                      placeholder={t('选择分组')}
                      value={selectedGroup}
                      onChange={handleGroupChange}
                      optionList={groupOptions}
                      style={{ width: 250 }}
                      className="group-select"
                      renderSelectedItem={(optionNode) => {
                        // 获取选中项的文本，如果是全部则显示"全部"，否则显示对应的分组名称
                        let displayText = '';
                        if (selectedGroup === 'all') {
                          displayText = '全部';
                        } else if (prefixGroups[selectedGroup]) {
                          displayText = prefixGroups[selectedGroup].name;
                        }

                        return (
                            <div className="selected-group-item" style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--semi-color-primary)',
                              backgroundColor: 'var(--semi-color-bg-0)',
                              padding: '4px 12px',
                              borderRadius: '4px',
                              fontWeight: 500,
                              boxShadow: '0 0 0 1px var(--semi-color-primary-light-active)',
                              minWidth: '100px',
                              width: '100%',
                              height: '100%'
                            }}>
                              <IconFilter size="small" style={{ marginRight: '6px', color: 'var(--semi-color-primary)' }} />
                              <span style={{ color: 'var(--semi-color-primary)' }}>{displayText}</span>
                            </div>
                        );
                      }}
                  />
                  <Popover
                      content={
                        <div className="w-80 md:w-96 p-4 font-sans text-sm leading-normal text-gray-700 bg-white rounded-xl shadow-lg border border-gray-100">
                          <div className="flex items-bottom mb-3 text-gray-800">
                            <h3 className="font-semibold text-base leading-none">分组说明(不通渠道的前缀不同)</h3>
                          </div>
                          <div className="space-y-3">

                            <div className="p-3 bg-gray-50 rounded-lg">
                              <p className="font-bold text-gray-800">折扣分组</p>
                              <p className="text-gray-600 mt-1 text-xs">限时的折扣分组，稳定性和混合分组相当，推荐用于大多数常规业务。</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <p className="font-bold text-gray-800">Azure特价渠道</p>
                              <p className="text-gray-600 mt-1 text-xs">具备一定性价比，但可能存在稳定性波动。</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <p className="font-bold text-gray-800">混合分组</p>
                              <p className="text-gray-600 mt-1 text-xs">综合性价比与性能，推荐用于大多数常规业务。</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <p className="font-bold text-gray-800">逆向渠道</p>
                              <p className="text-gray-600 mt-1 text-xs">价格极低，但稳定性和可用性相对较差，适合非关键场景。</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <p className="font-bold text-gray-800">官方正价渠道</p>
                              <p className="text-gray-600 mt-1 text-xs">价格较高但提供最优稳定性与可靠性，适用于生产环境或高要求任务。</p>
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-500 italic">请根据业务需求合理选择模型，并及时调整API调用配置。</p>
                          </div>
                        </div>
                      }
                      position="top"
                      trigger="hover"
                  >
                    <IconHelpCircle className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors" />
                  </Popover>
                </div>

                {/* Add the toggle switch here */}
                {/*<div className="group-toggle flex items-center">*/}
                {/*  <span className="text-sm text-gray-500 mr-2">{t('仅显示当前分组')}</span>*/}
                {/*  <div*/}
                {/*      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${showOnlySelectedGroup ? 'bg-blue-600' : 'bg-gray-200'}`}*/}
                {/*      onClick={() => {*/}
                {/*        setShowOnlySelectedGroup(!showOnlySelectedGroup);*/}
                {/*        setActivePage(1); // 重置页码为第一页*/}
                {/*      }}*/}
                {/*      role="switch"*/}
                {/*      aria-checked={showOnlySelectedGroup}*/}
                {/*      tabIndex="0"*/}
                {/*  >*/}
                {/*    <span*/}
                {/*        className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${showOnlySelectedGroup ? 'translate-x-6' : 'translate-x-1'}`}*/}
                {/*    />*/}
                {/*  </div>*/}
                {/*</div>*/}

                <div className="model-count flex items-center">
                  <IconStar size="small" style={{ marginRight: '6px', color: 'rgba(var(--semi-blue-5), 1)' }} />
                  <span>{t('当前展示 {{count}} 个模型', { count: filteredModels.length })}</span>
                  {(selectedProvider !== '全部' || filteredValue.length > 0) && (
                      <Button
                          type="tertiary"
                          theme="borderless"
                          onClick={(e) => {
                            e.preventDefault(); // 阻止默认行为
                            setSelectedProvider('全部');
                            setFilteredValue([]);
                            setActivePage(1); // 重置页码为第一页
                          }}
                          style={{marginLeft: '8px'}}
                      >
                        {t('清除筛选')}
                      </Button>
                  )}
                </div>

                <div className="action-buttons flex items-center gap-2">
                  <Button
                      theme='light'
                      type='tertiary'
                      style={{width: 150}}
                      onClick={(e) => {
                        copyText(selectedRowKeys);
                      }}
                      disabled={selectedRowKeys == ""}
                      icon={<IconTerminal size="small" />}
                  >
                    {t('复制选中模型')}
                  </Button>

                  <Button
                      theme='light'
                      type='tertiary'
                      onClick={() => setShowRatioColumn(!showRatioColumn)}
                      className="toggle-ratio-btn"
                  >
                    {showRatioColumn ? t('隐藏倍率列') : t('显示倍率列')}
                  </Button>
                </div>
              </div>

              {/* 添加表格容器，增强滚动体验 */}
              <div className="relative overflow-hidden md:rounded-lg border border-gray-50 shadow-sm hidden md:block">
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-gray-50 mobile-table-container max-w-full lg:max-w-[95vw] xl:max-w-[1400px] 2xl:max-w-[1800px] mx-auto">
                  <Table
                      style={{ marginTop: 0, width: '100%', tableLayout: 'fixed' }}
                      columns={columns}
                      dataSource={filteredModels}
                      loading={loading}
                      pagination={{
                        formatPageText: (page) =>
                            t('第 {{start}} - {{end}} 条，共 {{total}} 条', {
                              start: page.currentStart,
                              end: page.currentEnd,
                              total: filteredModels.length
                            }),
                        pageSize: pageSize,
                        total: filteredModels.length,
                        showSizeChanger: true,
                        pageSizeOptions: [10, 20, 50, 100],
                        onPageSizeChange: (size) => {
                          setPageSize(size);
                          setActivePage(1);
                        },
                        onPageChange: (page) => setActivePage(page)
                      }}
                      rowSelection={rowSelection}
                      className="responsive-table model-table w-full"
                      empty={
                        <div className="empty-state">
                          <p>{t('没有找到匹配的模型')}</p>
                          <Button
                              type="tertiary"
                              onClick={(e) => {
                                e.preventDefault(); // 阻止默认行为
                                setSelectedProvider('全部');
                                setFilteredValue([]);
                                setActivePage(1); // 重置页码为第一页
                              }}
                              className="mx-auto"
                          >
                            {t('重置筛选条件')}
                          </Button>
                        </div>
                      }
                      scroll={{ x: '100%' }}
                      rowClassName={(record, index) =>
                          'bg-gray-50 hover:bg-primary-light-default hover:bg-opacity-20 transition-colors'
                      }
                      headerClassName="bg-gray-50 text-gray-400 font-normal sticky top-0 z-10"
                      wrapperClassName="border-collapse w-full"
                      onRow={(record, index) => ({
                        onClick: () => {}, // 需要一个空函数，否则在某些情况下可能会报错
                      })}
                      onHeaderRow={() => ({
                        className: 'semi-table-header-row',
                      })}
                  />
                </div>

                {/* 滚动阴影指示器 - 桌面端 */}
                <div className="hidden lg:hidden md:block absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-transparent to-transparent pointer-events-none scroll-indicator"></div>
                <div className="hidden lg:hidden md:block absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-transparent to-transparent pointer-events-none scroll-indicator"></div>
              </div>

              {/* 移动端卡片视图 - 替代表格 */}
              <div className="md:hidden mt-4 space-y-4">
                {filteredModels.length === 0 ? (
                    <div className="empty-state py-8 text-center">
                      <p className="text-gray-500 mb-3">{t('没有找到匹配的模型')}</p>
                      <Button
                          type="tertiary"
                          onClick={(e) => {
                            e.preventDefault(); // 阻止默认行为
                            setSelectedProvider('全部');
                            setFilteredValue([]);
                            setActivePage(1); // 重置页码为第一页
                          }}
                          className="mx-auto"
                      >
                        {t('重置筛选条件')}
                      </Button>
                    </div>
                ) : (
                    filteredModels.slice((activePage-1) * pageSize, activePage * pageSize).map((model, index) => (
                        <div key={model.key} className="bg-transparent rounded-lg shadow-sm overflow-hidden border border-gray-100">
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                            <div className="flex justify-between items-center">
                              <div
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer whitespace-nowrap max-w-full overflow-hidden"
                                  style={{
                                    background: 'linear-gradient(to right, var(--semi-color-primary-light-default), var(--semi-color-primary-light-hover))',
                                    color: 'var(--semi-color-primary)',
                                    borderColor: 'var(--semi-color-primary-light-active)',
                                    borderWidth: '1px',
                                    borderStyle: 'solid'
                                  }}
                                  onClick={() => copyText(model.model_name)}
                                  title={model.model_name}
                              >
                                <span className="truncate">{model.model_name}</span>
                              </div>
                              {(() => {
                                let available = false;
                                if (selectedGroup === 'all') {
                                  available = true;
                                } else {
                                  const modelPrefixGroup = getModelPrefixGroup(model.model_name);
                                  available = modelPrefixGroup === selectedGroup;
                                }
                                return <div className="flex items-center text-white bg-green-700 py-1 px-3 rounded-md border border-green-600 shadow-md">
                                  <IconVerify size="small" style={{ color: 'white' }} />
                                  <span className="ml-1 text-xs font-bold">{t('当前分组可用')}</span>
                                </div>

                                // available ? (
                                //   <div className="flex items-center text-white bg-green-700 py-1 px-3 rounded-md border border-green-600 shadow-md">
                                //     <IconVerify size="small" style={{ color: 'white' }} />
                                //     <span className="ml-1 text-xs font-bold">{t('当前分组可用')}</span>
                                //   </div>
                                // )
                                //     : (
                                //   <div className="flex items-center text-white bg-red-600 py-1 px-3 rounded-md border border-red-500 shadow-md">
                                //     <IconClose size="small" style={{ color: 'white' }} />
                                //     <span className="ml-1 text-xs font-bold">{t('当前分组不可用')}</span>
                                //   </div>
                                // );
                              })()}
                            </div>
                          </div>

                          <div className="p-4 space-y-3 bg-transparent">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">{t('计费类型')}</span>
                              <div>{renderQuotaType(parseInt(model.quota_type))}</div>
                            </div>

                            <div>
                              <div className="text-gray-600 mb-1">{t('可用分组')}</div>
                              <div className="flex flex-wrap gap-1.5">
                                {model.enable_groups.map((group) => {
                                  if (usableGroup[group]) {
                                    const colorStyle = getGroupColor(group);

                                    if (group === selectedGroup) {
                                      return (
                                          <div key={group} className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${colorStyle.bg} shadow-md`} style={{ borderWidth: '0px', borderStyle: 'solid' }}>
                                            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path>
                                            </svg>
                                            {group}
                                          </div>
                                      );
                                    } else {
                                      return (
                                          <div
                                              key={group}
                                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorStyle.unselected} cursor-pointer hover:opacity-100 transition-opacity opacity-100 shadow-sm`}
                                              onClick={() => {
                                                setSelectedGroup(group);
                                                setActivePage(1); // 重置页码为第一页
                                                showInfo(t('当前查看的分组为：{{group}}', {
                                                  group: group
                                                }));
                                              }}
                                          >
                                            {group}
                                          </div>
                                      );
                                    }
                                  }
                                  return null;
                                })}
                              </div>
                            </div>

                            {showRatioColumn && (
                                <div>
                                  <div className="text-gray-600 mb-1">{t('倍率')}</div>
                                  <div className="bg-gray-50 p-2 rounded text-sm space-y-1">
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">{t('模型倍率')}</span>
                                      <span className="font-medium text-gray-700">{model.quota_type === 0 ? model.model_ratio : t('无')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">{t('补全倍率')}</span>
                                      <span className="font-medium text-gray-700">{model.quota_type === 0 ? parseFloat(model.completion_ratio.toFixed(3)) : t('无')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">{t('分组倍率')}</span>
                                      <span className="font-medium text-gray-700">1</span>
                                    </div>
                                  </div>
                                </div>
                            )}

                            <div>
                              <div className="text-gray-600 mb-1">{t('模型价格')}</div>
                              <div className="bg-blue-50 bg-opacity-60 p-2 rounded text-sm">
                                {model.quota_type === 0 ? (
                                    <>
                                      <div className="flex justify-between items-center">
                                        <span className="text-gray-500">{t('提示')}</span>
                                        <span className="font-medium text-blue-500">
                                  {currencyType === 'USD' ? '$' : '￥'}
                                          {currencyType === 'CNY'
                                              ? ((model.model_ratio * 2 * 1)).toFixed(2)
                                              : (model.model_ratio * 2 * 1).toFixed(2)} / 1M tokens
                                </span>
                                      </div>
                                      <div className="flex justify-between items-center mt-1">
                                        <span className="text-gray-500">{t('补全')}</span>
                                        <span className="font-medium text-blue-500">
                                  {currencyType === 'USD' ? '$' : '￥'}
                                          {currencyType === 'CNY'
                                              ? ((model.model_ratio * model.completion_ratio * 2 * 1)).toFixed(2)
                                              : (model.model_ratio * model.completion_ratio * 2 * 1/7.29).toFixed(2)} / 1M tokens
                                </span>
                                      </div>
                                    </>
                                ) : (
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-500">{t('模型价格')}</span>
                                      <span className="font-medium text-blue-500">
                                {currencyType === 'USD' ? '$' : '￥'}
                                        {(parseFloat(model.model_price) * 1).toFixed(2)}
                              </span>
                                    </div>
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="text-gray-600 mb-1">{t('模型描述')}</div>
                              <div className="text-gray-500 text-sm line-clamp-4 min-h-[5em] bg-gray-50 p-2 rounded">
                                {model.model_description}
                              </div>
                              <Button
                                theme="light"
                                type="primary"
                                size="small"
                                icon={<IconPlay />}
                                onClick={() => handleQuickTest(model.model_name)}
                                style={{
                                  marginTop: '8px',
                                  fontSize: '12px',
                                  padding: '4px 8px',
                                  height: '28px'
                                }}
                              >
                                {t('立即体验')}
                              </Button>
                            </div>
                          </div>
                        </div>
                    ))
                )}

                {/* 移动端分页器 */}
                {filteredModels.length > 0 && (
                    <div className="flex flex-col items-center mt-6 gap-3">
                      <div className="inline-flex items-center shadow-sm rounded-md">
                        <button
                            className="px-3 py-1 bg-white border border-gray-300 rounded-l-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={activePage === 1}
                            onClick={() => setActivePage(prev => prev - 1)}
                        >
                          <IconChevronLeft size="small" />
                        </button>
                        <div className="px-4 py-1 bg-white border-t border-b border-gray-300 text-gray-700">
                          {activePage} / {Math.ceil(filteredModels.length / pageSize)}
                        </div>
                        <button
                            className="px-3 py-1 bg-white border border-gray-300 rounded-r-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={activePage === Math.ceil(filteredModels.length / pageSize)}
                            onClick={() => setActivePage(prev => prev + 1)}
                        >
                          <IconChevronRight size="small" />
                        </button>
                      </div>

                      {/* 每页显示条数选择 */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">{t('每页显示')}:</span>
                        <div className="inline-flex rounded-md shadow-sm">
                          {[5, 10, 20, 50].map(size => (
                              <button
                                  key={size}
                                  className={`px-2.5 py-1 border border-gray-300 text-xs font-medium ${
                                      pageSize === size
                                          ? 'bg-blue-50 text-blue-700 border-blue-300 z-10'
                                          : 'bg-white text-gray-700 hover:bg-gray-50'
                                  } ${
                                      size === 5 ? 'rounded-l-md' : ''
                                  } ${
                                      size === 50 ? 'rounded-r-md' : ''
                                  }`}
                                  onClick={() => {
                                    setPageSize(size);
                                    setActivePage(1);
                                  }}
                              >
                                {size}
                              </button>
                          ))}
                        </div>
                        <span className="text-gray-600">{t('条')}</span>
                      </div>

                      <div className="text-xs text-gray-500">
                        {t('第 {{start}} - {{end}} 条，共 {{total}} 条', {
                          start: Math.min((activePage - 1) * pageSize + 1, filteredModels.length),
                          end: Math.min(activePage * pageSize, filteredModels.length),
                          total: filteredModels.length
                        })}
                      </div>
                    </div>
                )}
              </div>

              <ImagePreview
                  src={modalImageUrl}
                  visible={isModalOpenurl}
                  onVisibleChange={(visible) => setIsModalOpenurl(visible)}
              />
            </Card>
          </div>
        </Layout>
      </>
  );
};

export default ModelPricing;
