import React, { useContext, useEffect, useState, useRef, useMemo } from 'react';
import { Card, Col, Row, Button, Space, Divider, Avatar, Timeline, Input, Table, Tag, Tooltip, Popover, ImagePreview, Banner, Layout, Select, Modal } from '@douyinfe/semi-ui';
import { Typography } from '@douyinfe/semi-ui';
import { Tabs } from '@douyinfe/semi-ui';
import { API, showError, showNotice, showInfo, showSuccess, timestamp2string, copy } from '../../helpers';
import { StatusContext } from '../../context/Status';
import { marked } from 'marked';
import { StyleContext } from '../../context/Style/index.js';
import { useTranslation } from 'react-i18next';
import {
  IconStar,
  IconTerminal,
  IconChevronRight,
  IconVerify,
  IconHelpCircle,
  IconClose,
  IconMore,
  IconUploadError,
  IconChevronLeft,
  IconFilter,
  IconCode
} from '@douyinfe/semi-icons';
import './HomeStyles.css';
import ModelPricing from '../../components/ModelPricing';
import { useDispatch,useSelector } from 'react-redux'
import {fetchAdvantages, fetchProviders, fetchTypingList, updateAdvantages} from '../../store/setting/providers.js'
import { useNavigate } from 'react-router-dom';
import ApiGuideDrawer from '../../components/ApiGuideDrawer';

const Home = () => {
  const { t, i18n } = useTranslation();
  const [homePageContentLoaded, setHomePageContentLoaded] = useState(false);
  const [homePageContent, setHomePageContent] = useState('');
  const [typedText, setTypedText] = useState('');
  const [typingIndex, setTypingIndex] = useState(0);
  // 打字间隔 & 切换间隔（毫秒）
  const typingDelay = 100;
  const pauseDelay = 500;

  // 2. 状态
  const [currentTextIndex, setCurrentTextIndex] = useState(0);


  const [modelPricingApi, setModelPricingApi] = useState(null);
  // 处理 ModelPricing 组件初始化
  const handleModelPricingInit = (api) => {
    setModelPricingApi(api);
  };

  const dispatch = useDispatch();
  const { providers = [], advantages = [], systemName = 'Your API',typingList } = useSelector((state) => state.providers);

  const [noticeVisible, setNoticeVisible] = useState(false);
  const [noticeContent, setNoticeContent] = useState('');
  const navigate = useNavigate();

  const [apiDrawerVisible, setApiDrawerVisible] = useState(false);
  const { Text, Title, Paragraph } = Typography;

  useEffect(() => {
    if (advantages.length === 0) {
      dispatch(fetchAdvantages());
    }
    if (typingList.length === 0) {
      dispatch(fetchTypingList());
    }
  }, [dispatch]);

  // 打字效果
  useEffect(() => {
    // 确保 typingList 已加载且有数据
    if (!typingList || typingList.length === 0) {
      return; // 如果没有数据，直接退出该 effect
    }
    // 当前字符串
    const currentString = typingList[currentTextIndex];

    let timeoutId;
    if (typingIndex < currentString.length) {
      // —— 还没打完，就继续打下一个字符
      timeoutId = setTimeout(() => {
        setTypedText(prev => prev + currentString[typingIndex]);
        setTypingIndex(prev => prev + 1);
      }, typingDelay);
    } else {
      // —— 敲完了，短暂停顿后清空并切换到下一条
      timeoutId = setTimeout(() => {
        setTypedText('');                                           // 清空文字
        setTypingIndex(0);                                         // 重置字符下标
        setCurrentTextIndex((currentTextIndex + 1) % typingList.length); // 循环下标
      }, pauseDelay);
    }

    return () => clearTimeout(timeoutId);
  }, [typingList,typingIndex, currentTextIndex]);  // 依赖：字符下标 & 文本下标

  const displayNotice = async () => {
    const res = await API.get('/api/notice');
    const { success, message, data } = res.data;
    if (success) {
      let oldNotice = localStorage.getItem('notice');
      const today = new Date().toDateString();
      const skipToday = localStorage.getItem('notice_skip_today') === today;

      if (data && data !== '' && !skipToday) {
        const htmlNotice = marked(data);
        setNoticeContent(htmlNotice);
        setNoticeVisible(true);
        localStorage.setItem('notice', data);
      }
    } else {
      showError(message);
    }
  };

  const handleSkipToday = () => {
    const today = new Date().toDateString();
    localStorage.setItem('notice_skip_today', today);
    setNoticeVisible(false);
  };

  const handleUnderstand = () => {
    setNoticeVisible(false);
  };

  const displayHomePageContent = async () => {
    setHomePageContent(localStorage.getItem('home_page_content') || '');
    const res = await API.get('/api/home_page_content');
    const { success, message, data } = res.data;
    if (success) {
      let content = data;
      if (!data.startsWith('https://')) {
        content = marked.parse(data);
      }
      setHomePageContent(content);
      localStorage.setItem('home_page_content', content);

        // 如果内容是 URL，则发送主题模式
        if (data.startsWith('https://')) {
            const iframe = document.querySelector('iframe');
            if (iframe) {
                const theme = localStorage.getItem('theme-mode') || 'light';
                // 测试是否正确传递theme-mode给iframe
                // console.log('Sending theme-mode to iframe:', theme);
                iframe.onload = () => {
                    iframe.contentWindow.postMessage({ themeMode: theme }, '*');
                    iframe.contentWindow.postMessage({ lang: i18n.language }, '*');
                };
            }
        }
    } else {
      showError(message);
      setHomePageContent('加载首页内容失败...');
    }
    setHomePageContentLoaded(true);
  };

  // 点击开始使用按钮
  const handleStartUse = () => {
    window.location.href = '/token'; // 假设"开始使用"跳转到token管理页
  };

  // 点击开发文档按钮
  const handleOpenDocs = () => {
    navigate('/docs');
  };

  // 点击模型卡片
  const handleModelClick = (model) => {
    // 跳转到模型价格区域
    const pricingSection = document.querySelector('.model-pricing-section');
    if (pricingSection) {
      pricingSection.scrollIntoView({ behavior: 'smooth' });

      // 找到对应的供应商名称
      let providerId = model.id;


      // 设置当前选中的供应商
      setTimeout(() => {
        modelPricingApi.setSelectedProvider(providerId);
      }, 500);
    }
  };

  const handleModelListClick = () => {
    window.location.href = '/pricing';
  };

  // 点击快速接入按钮
  const handleQuickAccess = () => {
    setApiDrawerVisible(true);
  };

  useEffect(() => {
    displayNotice().then();
    displayHomePageContent().then();
  }, []);

  return (
    <>
      <div className="max-w-[1300px] w-full p-3 select-none m-auto">
        <Row >
          <Col md={24} lg={12}>
            <div className="flex flex-col justify-center h-full pt-4 md:pt-28">
              <h1 className="text-7xl bg-uc-argon text-wrap">{systemName}</h1>
              <div className="mt-5 overflow-hidden">
                <div
                    className="text-3xl prose prose-lg dark:prose-invert max-h-[300px] overflow-y-auto custom-scrollbar"
                    dangerouslySetInnerHTML={{ __html: homePageContent }}
                />
              </div>
              <p className="mt-5">
                <span className="text-xl">{typedText}</span>
                <span className="typed-cursor" aria-hidden="true">|</span>
              </p>
              <Space className="mt-5" align="baseline">
                <Button theme="solid" type="primary" size="large" onClick={handleStartUse}>
                  <div className="flex items-center">
                    <IconStar style={{ fontSize: '20px', marginRight: '4px' }} />
                    开始使用
                  </div>
                </Button>
                <Button theme="light" type="primary" size="large" onClick={handleOpenDocs}>
                  <div className="flex items-center">
                    <IconTerminal style={{ fontSize: '20px', marginRight: '4px' }} />
                    开发文档
                  </div>
                </Button>
                <Button theme="light" type="primary" size="large" onClick={handleQuickAccess}>
                  <div className="flex items-center">
                    <IconVerify style={{ fontSize: '20px', marginRight: '4px' }} />
                    快速接入
                  </div>
                </Button>
              </Space>
            </div>
          </Col>
          <Col md={24} lg={12} style={{ marginTop: '2rem' }}>
            <img alt="bg" src="/models/yourapi.svg" style={{ maxWidth: '100%' }} />
          </Col>
        </Row>

        {/* AI模型展示部分 */}
        <div className="py-16">
          <div className="h-1 w-full">
            <Divider dashed />
          </div>
        </div>

        <div className="flex justify-center">
          <p className="text-3xl font-bold">众多AI大模型完美适配</p>
        </div>

        <div className="mt-16">
          <Row gutter={[24, 24]}>
            {providers.map(model => (
              <Col xs={24} sm={24} md={12} lg={6} key={model.id}>
                <Card
                  className="mb-5 card-shadow-md hover-trans-m-top-sm cursor-pointer"
                  onClick={() => handleModelClick(model)}
                  bodyStyle={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <Card.Meta
                    avatar={
                      model.id === 1 ? (
                        <div
                          className="layoutkit-center"
                          style={{
                            background: model.bgColor,
                            borderRadius: '50%',
                            color: '#fff',
                            height: '40px',
                            width: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <svg fill="currentColor" fillRule="evenodd" height="30" viewBox="0 0 24 24" width="30" xmlns="http://www.w3.org/2000/svg" color="#fff">
                            <title>OpenAI</title>
                            <path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"></path>
                          </svg>
                        </div>
                      ) : (
                        <Avatar
                          src={model.icon}
                          alt={model.name}
                        />
                      )
                    }
                    title={model.name}
                  />
                  <IconChevronRight />
                </Card>
              </Col>
            ))}
          </Row>
          <div className="text-center mt-5 text-gray-500">
            已适配的大模型不止于此，更多的请到我们的
            <a onClick={handleModelListClick} style={{ cursor: 'pointer', color: 'var(--semi-color-primary)' }}>
              模型列表
            </a>
            中查看
          </div>
        </div>

        {/* 我们的优势部分 */}
        <div className="py-16">
          <div className="h-1 w-full">
            <Divider dashed />
          </div>
        </div>

        <div className="flex justify-center">
          <p className="text-3xl font-bold">我们的优势</p>
        </div>

        <div className="mt-16">
          <Row className="flex items-center justify-between" gutter={[100, 24]}>
            <Col md={24} lg={12}>
              <img alt="bg" src="/models/yourapi.svg" style={{ maxWidth: '100%' }} />
            </Col>
            <Col md={24} lg={12}>
              <Timeline mode="left">
                {advantages.map(advantage => (
                  <Timeline.Item
                    key={advantage.id}
                    dot={
                      <i
                        className={`fa ${advantage.icon}`}
                        style={{ fontSize: '20px', color: advantage.color }}
                      />
                    }
                  >
                    {advantage.title}
                    <div className="semi-timeline-item-content-extra">
                      {advantage.description}
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Col>
          </Row>
        </div>

        {/* 模型价格部分 */}
        <div className="py-16">
          <div className="h-1 w-full">
            <Divider dashed />
          </div>
        </div>

        <div className="flex justify-center">
          <p className="text-3xl font-bold">模型价格</p>
        </div>

        <div className="mt-8 model-pricing-section">
          <ModelPricing onInitialize={handleModelPricingInit} />

        </div>

        <div className="py-8 h-1 w-full">
          <Divider dashed />
        </div>


        {homePageContentLoaded && homePageContent && homePageContent.startsWith('https://') && (
          <div className="mt-4">
            <iframe
              src={homePageContent}
              style={{ width: '100%', height: '80vh', border: 'none' }}
              title="home page"
            ></iframe>
          </div>
        )}
      </div>

      {/* API接入指南抽屉 */}
      <ApiGuideDrawer
        visible={apiDrawerVisible}
        onClose={() => setApiDrawerVisible(false)}
        baseUrl=""
        modelId="gpt-4o"
      />

      {/* 自定义通知弹窗 */}
      {noticeVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md md:max-w-lg lg:max-w-xl transform transition-all overflow-hidden">
            <div className="p-0">
              {/* 弹窗标题栏 */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">系统通知</h3>
                <button
                  onClick={() => setNoticeVisible(false)}
                  className="text-white hover:text-gray-200 focus:outline-none"
                >
                  <IconClose />
                </button>
              </div>

              {/* 弹窗内容区 */}
              <div className="p-6 bg-white dark:bg-gray-800">
                <div className="notice-content max-h-[50vh] overflow-y-auto mb-6 prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg max-w-none">
                  <div
                    dangerouslySetInnerHTML={{ __html: noticeContent }}
                    className="text-gray-800 dark:text-gray-200"
                  />
                </div>

                {/* 弹窗按钮区 */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    onClick={handleSkipToday}
                    theme="borderless"
                    className="order-2 sm:order-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    今日不显示
                  </Button>
                  <Button
                    onClick={handleUnderstand}
                    theme="solid"
                    type="primary"
                    className="order-1 sm:order-2"
                  >
                    我已了解
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Home;
