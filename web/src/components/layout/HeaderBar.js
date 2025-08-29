/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { UserContext } from '../../context/User/index.jsx';
import { useSetTheme, useTheme } from '../../context/Theme/index.jsx';
import { useTranslation } from 'react-i18next';

import { API, getLogo, getSystemName, isMobile, showSuccess } from '../../helpers/index.js';
import '../../index.css';

import fireworks from 'react-fireworks';

import {
  IconClose,
  IconHelpCircle,
  IconHome,
  IconHomeStroked,
  IconIndentLeft,
  IconComment,
  IconKey,
  IconMenu,
  IconNoteMoneyStroked,
  IconPriceTag,
  IconUser,
  IconLanguage,
  IconInfoCircle,
  IconCreditCard,
  IconTerminal,
  IconFilpVertical,
  IconCode,
} from '@douyinfe/semi-icons';
import {
  Avatar,
  Button,
  Dropdown,
  Layout,
  Nav,
  Switch,
  Tag,
  SideSheet,
  List,
  Space,
} from '@douyinfe/semi-ui';
import { stringToColor } from '../../helpers/render.jsx';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import { StyleContext } from '../../context/Style/index.js';
import { StatusContext } from '../../context/Status/index.jsx';
import {useDispatch, useSelector} from "react-redux";
import {fetchCustemNavLinks, fetchTypingList} from "../../store/setting/providers.js";

// 自定义顶部栏样式
const headerStyle = {
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
  borderBottom: '1px solid var(--semi-color-border)',
  background: 'var(--semi-color-bg-0)',
  transition: 'all 0.3s ease',
  width: '100%',
};

// 自定义顶部栏按钮样式
const headerItemStyle = {
  borderRadius: '4px',
  margin: '0 4px',
  transition: 'all 0.3s ease',
};

// 自定义顶部栏按钮悬停样式
const headerItemHoverStyle = {
  backgroundColor: 'var(--semi-color-primary-light-default)',
  color: 'var(--semi-color-primary)',
};

// 自定义顶部栏Logo样式
const logoStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '0 10px',
  height: '100%',
};

// 自定义顶部栏系统名称样式
const systemNameStyle = {
  fontWeight: 'bold',
  fontSize: '22px',
  background:
    'linear-gradient(45deg, var(--semi-color-primary), var(--semi-color-secondary))',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  padding: '0 5px',
};

// 自定义顶部栏按钮图标样式
const headerIconStyle = {
  fontSize: '18px',
  transition: 'all 0.3s ease',
};

// 自定义头像样式
const avatarStyle = {
  margin: '4px',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  transition: 'all 0.3s ease',
};

// 自定义下拉菜单样式
const dropdownStyle = {
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  overflow: 'hidden',
};

// 自定义主题切换开关样式
const switchStyle = {
  margin: '0 8px',
};

// 移动端导航抽屉样式
const mobileNavDrawerStyle = {
  padding: '16px 0',
};

// 移动端导航项样式
const mobileNavItemStyle = {
  padding: '12px 16px',
  borderRadius: '8px',
  margin: '4px 8px',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const HeaderBar = ({ onMobileMenuToggle, drawerOpen }) => {
  const { t, i18n } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const [styleState, styleDispatch] = useContext(StyleContext);
  const [statusState, statusDispatch] = useContext(StatusContext);
  let navigate = useNavigate();
  const location = useLocation();
  const [currentLang, setCurrentLang] = useState(i18n.language);
  const dispatch = useDispatch();
  const [mobileNavVisible, setMobileNavVisible] = useState(false);

  const systemName = getSystemName();
  const logo = getLogo();
  const currentDate = new Date();
  // enable fireworks on new year(1.1 and 2.9-2.24)
  const isNewYear = currentDate.getMonth() === 0 && currentDate.getDate() === 1;
  
  // Check if we're on a console page
  const isConsoleRoute = location.pathname.startsWith('/console');

  // Check if self-use mode is enabled
  const isSelfUseMode = statusState?.status?.self_use_mode_enabled || false;
  const docsLink = statusState?.status?.docs_link || '';
  const isDemoSiteMode = statusState?.status?.demo_site_enabled || false;

  const { custemNavLinks = []} = useSelector((state) => state.providers);

  useEffect(() => {
    dispatch(fetchCustemNavLinks());
  }, [dispatch]);

  let buttons = [
    {
      text: t('首页'),
      itemKey: 'home',
      to: '/',
      icon: <IconHome style={headerIconStyle} />,
    },
    {
      text: t('控制台'),
      itemKey: 'detail',
      to: '/console',
      icon: <IconTerminal style={headerIconStyle} />,
    },
    {
      text: t('充值'),
      itemKey: 'topup',
      to: '/console/topup',
      icon: <IconCreditCard style={headerIconStyle} />,
    },
    {
      text: t('模型广场'),
      itemKey: 'models',
      to: '/pricing',
      icon: <IconTerminal style={headerIconStyle} />,
    },
    {
      text: t('定价'),
      itemKey: 'prices',
      to: '/prices',
      icon: <IconPriceTag style={headerIconStyle} />,
    },
    // Only include the docs button if docsLink exists
    ...(docsLink
      ? [
          {
            text: t('文档'),
            itemKey: 'docs',
            to: '/docs',
            icon: <IconHelpCircle style={headerIconStyle} />,
          },
        ]
      : []),
    // Claude Code link
    {
      text: 'Claude Code',
      itemKey: 'claude-code',
      isExternal: true,
      externalLink: 'https://doc.yourapi.cn/',
      icon: <IconCode style={headerIconStyle} />,
    },
    // Add custom navigation links from the backend
    ...custemNavLinks.map(link => ({
      text: t(link.text),
      itemKey: link.item_key,
      isExternal: true,
      externalLink: link.url,
      icon: <IconFilpVertical style={headerIconStyle} />,
    })),
    {
      text: t('联系我们'),
      itemKey: 'about',
      to: '/about',
      icon: <IconInfoCircle style={headerIconStyle} />,
    },
  ];

  async function logout() {
    await API.get('/api/user/logout');
    showSuccess(t('注销成功!'));
    userDispatch({ type: 'logout' });
    localStorage.removeItem('user');
    navigate('/login');
  }

  const handleNewYearClick = () => {
    fireworks.init('root', {});
    fireworks.start();
    setTimeout(() => {
      fireworks.stop();
      setTimeout(() => {
        window.location.reload();
      }, 10000);
    }, 3000);
  };

  const theme = useTheme();
  const setTheme = useSetTheme();

  useEffect(() => {
    if (theme === 'dark') {
      document.body.setAttribute('theme-mode', 'dark');
    } else {
      document.body.removeAttribute('theme-mode');
    }
    // 发送当前主题模式给子页面
    const iframe = document.querySelector('iframe');
    if (iframe) {
      iframe.contentWindow.postMessage({ themeMode: theme }, '*');
    }

    if (isNewYear) {
      console.log('Happy New Year!');
    }
  }, [theme]);

  useEffect(() => {
    const handleLanguageChanged = (lng) => {
      setCurrentLang(lng);
      const iframe = document.querySelector('iframe');
      if (iframe) {
        iframe.contentWindow.postMessage({ lang: lng }, '*');
      }
    };

    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n]);

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
  };

  const handleNavItemClick = (itemKey, to, isExternal, externalLink) => {
    if (isExternal && externalLink) {
      // 判断如果以/开头，则为相对路径,然后路由跳转打开
        // 否则为绝对路径，直接打开
        if (externalLink.startsWith('/')) {
            navigate(externalLink);
        } else {
            window.open(externalLink, '_blank');
        }

    } else {
      if (itemKey === 'home') {
        styleDispatch({
          type: 'SET_INNER_PADDING',
          payload: false,
        });
        styleDispatch({ type: 'SET_SIDER', payload: false });
      } else {
        styleDispatch({
          type: 'SET_INNER_PADDING',
          payload: true,
        });
        styleDispatch({ type: 'SET_SIDER', payload: true });
      }
      navigate(to);
    }
    setMobileNavVisible(false);
  };

  // 切换侧边栏显示状态
  const toggleSider = () => {
    styleDispatch({ type: 'SET_SIDER', payload: !styleState.showSider });
    setMobileNavVisible(false);
  };

  // 移动端导航抽屉
  const renderMobileNavDrawer = () => {
    return (
      <SideSheet
        title={
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              cursor: 'pointer',
            }}
            onClick={() => {
              navigate('/');
              styleDispatch({
                type: 'SET_INNER_PADDING',
                payload: false,
              });
              styleDispatch({ type: 'SET_SIDER', payload: false });
              setMobileNavVisible(false);
            }}
          >
            <img src={logo} alt="logo" style={{ height: '36px' }} />
            <span style={systemNameStyle}>{systemName}</span>
          </div>
        }
        visible={mobileNavVisible}
        onCancel={() => setMobileNavVisible(false)}
        placement="left"
        width={280}
        style={{ borderRadius: '0 16px 16px 0' }}
        headerStyle={{ padding: '16px' }}
        bodyStyle={mobileNavDrawerStyle}
        maskStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      >
        <List>
          {buttons.map((btn) => (
            <List.Item
              key={btn.itemKey}
              onClick={() => handleNavItemClick(btn.itemKey, btn.to, btn.isExternal, btn.externalLink)}
              style={mobileNavItemStyle}
              className="mobile-nav-item"
            >
              <div style={{ fontSize: '20px' }}>{btn.icon}</div>
              <span style={{ fontSize: '16px' }}>{btn.text}</span>
            </List.Item>
          ))}
          
          {/* 侧边栏切换按钮 */}
          <List.Item
            style={{
              ...mobileNavItemStyle,
              backgroundColor: 'var(--semi-color-primary-light-default)',
              marginTop: '16px',
            }}
            onClick={toggleSider}
            className="mobile-nav-item"
          >
            <div style={{ fontSize: '20px' }}>
              {styleState.showSider ? <IconIndentLeft /> : <IconMenu />}
            </div>
            <span style={{ fontSize: '16px', fontWeight: '500' }}>
              {styleState.showSider ? t('隐藏功能侧边栏') : t('显示功能侧边栏')}
            </span>
          </List.Item>
          
          <div style={{ margin: '20px 0', borderBottom: '1px solid var(--semi-color-border)' }} />
          
          {/* 用户相关操作 */}
          {userState.user ? (
            <List.Item
              style={mobileNavItemStyle}
              onClick={logout}
              className="mobile-nav-item"
            >
              <Avatar
                size="small"
                color={stringToColor(userState.user.username)}
              >
                {userState.user.username[0]}
              </Avatar>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: '500' }}>{userState.user.username}</span>
                <span style={{ fontSize: '12px', color: 'var(--semi-color-text-2)' }}>{t('退出')}</span>
              </div>
            </List.Item>
          ) : (
            <>
              <List.Item
                style={mobileNavItemStyle}
                onClick={() => {
                  navigate('/login');
                  setMobileNavVisible(false);
                }}
                className="mobile-nav-item"
              >
                <IconUser style={{ fontSize: '20px' }} />
                <span style={{ fontSize: '16px' }}>{t('登录')}</span>
              </List.Item>
              
              {!isSelfUseMode && (
                <List.Item
                  style={mobileNavItemStyle}
                  onClick={() => {
                    navigate('/register');
                    setMobileNavVisible(false);
                  }}
                  className="mobile-nav-item"
                >
                  <IconKey style={{ fontSize: '20px' }} />
                  <span style={{ fontSize: '16px' }}>{t('注册')}</span>
                </List.Item>
              )}
            </>
          )}
          
          {/* 设置区域 */}
          <div style={{ padding: '16px', marginTop: '8px' }}>
            <Space style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{theme === 'dark' ? t('深色模式') : t('浅色模式')}</span>
              <Switch
                checkedText='🌞'
                size='default'
                checked={theme === 'dark'}
                uncheckedText='🌙'
                onChange={(checked) => {
                  setTheme(checked);
                }}
              />
            </Space>
            
            <Space style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <span>{t('语言')}</span>
              <Space>
                <Button
                  type={currentLang === 'zh' ? 'primary' : 'tertiary'}
                  size="small"
                  onClick={() => handleLanguageChange('zh')}
                >
                  中文
                </Button>
                <Button
                  type={currentLang === 'en' ? 'primary' : 'tertiary'}
                  size="small"
                  onClick={() => handleLanguageChange('en')}
                >
                  English
                </Button>
              </Space>
            </Space>
          </div>
        </List>
      </SideSheet>
    );
  };

  return (
    <>
      <Layout>
        <div style={{ width: '100%' }}>
          <Nav
            className={'topnav'}
            mode={'horizontal'}
            style={headerStyle}
            itemStyle={headerItemStyle}
            hoverStyle={headerItemHoverStyle}
            renderWrapper={({ itemElement, isSubNav, isInSubNav, props }) => {
              const routerMap = {
                about: '/about',
                login: '/login',
                register: '/register',
                models: '/pricing',
                prices: '/prices',
                detail: '/console',
                topup: '/console/topup',
                home: '/',
                chat: '/chat',
                docs: '/docs',
              };
              return (
                <div
                  onClick={(e) => {
                    if (props.itemKey === 'home') {
                      styleDispatch({
                        type: 'SET_INNER_PADDING',
                        payload: false,
                      });
                      styleDispatch({ type: 'SET_SIDER', payload: false });
                    } else {
                      styleDispatch({
                        type: 'SET_INNER_PADDING',
                        payload: true,
                      });
                      if (!styleState.isMobile) {
                        styleDispatch({ type: 'SET_SIDER', payload: true });
                      }
                    }
                  }}
                >
                  {props.isExternal ? (
                    <a
                      className='header-bar-text'
                      style={{ textDecoration: 'none' }}
                      href={props.externalLink}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {itemElement}
                    </a>
                  ) : (
                    <Link
                      className='header-bar-text'
                      style={{ textDecoration: 'none' }}
                      to={routerMap[props.itemKey]}
                    >
                      {itemElement}
                    </Link>
                  )}
                </div>
              );
            }}
            selectedKeys={[]}
            // items={headerButtons}
            onSelect={(key) => {}}
            header={
              styleState.isMobile
                ? {
                    logo: (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          position: 'relative',
                          cursor: 'pointer',
                        }}
                      >
                        <Button
                          icon={<IconMenu />}
                          theme='light'
                          aria-label={t('打开导航菜单')}
                          onClick={() => setMobileNavVisible(true)}
                          style={{ marginRight: '8px' }}
                        />
                        {/* Console sidebar toggle button for mobile */}
                        {isConsoleRoute && (
                          <Button
                            icon={drawerOpen ? <IconIndentLeft /> : <IconMenu />}
                            theme='light'
                            aria-label={t('切换控制台侧边栏')}
                            onClick={onMobileMenuToggle}
                            style={{ marginRight: '8px' }}
                          />
                        )}
                        <img 
                          src={logo} 
                          alt='logo' 
                          style={{ height: '36px', cursor: 'pointer' }} 
                          onClick={() => {
                            navigate('/');
                            styleDispatch({
                              type: 'SET_INNER_PADDING',
                              payload: false,
                            });
                            styleDispatch({ type: 'SET_SIDER', payload: false });
                          }}
                        />
                        {(isSelfUseMode || isDemoSiteMode) && (
                          <Tag
                            color={isSelfUseMode ? 'purple' : 'blue'}
                            style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-15px',
                              fontSize: '0.7rem',
                              padding: '0 4px',
                              height: 'auto',
                              lineHeight: '1.2',
                              zIndex: 1,
                              pointerEvents: 'none',
                            }}
                          >
                            {isSelfUseMode ? t('自用模式') : t('演示站点')}
                          </Tag>
                        )}
                      </div>
                    ),
                  }
                : {
                    logo: (
                      <div 
                        style={{
                          ...logoStyle,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          navigate('/');
                          styleDispatch({
                            type: 'SET_INNER_PADDING',
                            payload: false,
                          });
                          styleDispatch({ type: 'SET_SIDER', payload: false });
                        }}
                      >
                        <img src={logo} alt='logo' style={{ height: '50px' }} />
                      </div>
                    ),
                    text: (
                      <div
                        style={{
                          position: 'relative',
                          display: 'inline-block',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          navigate('/');
                          styleDispatch({
                            type: 'SET_INNER_PADDING',
                            payload: false,
                          });
                          styleDispatch({ type: 'SET_SIDER', payload: false });
                        }}
                      >
                        <span style={systemNameStyle}>{systemName}</span>
                        {(isSelfUseMode || isDemoSiteMode) && (
                          <Tag
                            color={isSelfUseMode ? 'purple' : 'blue'}
                            style={{
                              position: 'absolute',
                              top: '-10px',
                              right: '-25px',
                              fontSize: '0.7rem',
                              padding: '0 4px',
                              whiteSpace: 'nowrap',
                              zIndex: 1,
                              boxShadow: '0 0 3px rgba(255, 255, 255, 0.7)',
                            }}
                          >
                            {isSelfUseMode ? t('自用模式') : t('演示站点')}
                          </Tag>
                        )}
                      </div>
                    ),
                  }
            }
            items={styleState.isMobile ? [] : buttons}
            footer={
              <>
                {isNewYear && !styleState.isMobile && (
                  // happy new year
                  <Dropdown
                    position='bottomRight'
                    render={
                      <Dropdown.Menu style={dropdownStyle}>
                        <Dropdown.Item onClick={handleNewYearClick}>
                          Happy New Year!!!
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    }
                  >
                    <Nav.Item itemKey={'new-year'} text={'🎉'} />
                  </Dropdown>
                )}
                {!styleState.isMobile && (
                  <>
                    <Switch
                      checkedText='🌞'
                      size={styleState.isMobile ? 'default' : 'large'}
                      checked={theme === 'dark'}
                      uncheckedText='🌙'
                      style={switchStyle}
                      onChange={(checked) => {
                        setTheme(checked);
                      }}
                    />
                  </>
                )}
                {!styleState.isMobile && (
                  <Dropdown
                    position='bottomRight'
                    render={
                      <Dropdown.Menu style={dropdownStyle}>
                        <Dropdown.Item
                          onClick={() => handleLanguageChange('zh')}
                          type={currentLang === 'zh' ? 'primary' : 'tertiary'}
                        >
                          中文
                        </Dropdown.Item>
                        <Dropdown.Item
                          onClick={() => handleLanguageChange('en')}
                          type={currentLang === 'en' ? 'primary' : 'tertiary'}
                        >
                          English
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    }
                  >
                    <Nav.Item
                      itemKey={'language'}
                      icon={<IconLanguage style={headerIconStyle} />}
                    />
                  </Dropdown>
                )}
                {userState.user && !styleState.isMobile ? (
                  <>
                    <Dropdown
                      position='bottomRight'
                      render={
                        <Dropdown.Menu style={dropdownStyle}>
                          <Dropdown.Item onClick={logout}>
                            {t('退出')}
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      }
                    >
                      <Avatar
                        size='small'
                        color={stringToColor(userState.user.username)}
                        style={avatarStyle}
                      >
                        {userState.user.username[0]}
                      </Avatar>
                      {styleState.isMobile ? null : (
                        <Text style={{ marginLeft: '4px', fontWeight: '500' }}>
                          {userState.user.username}
                        </Text>
                      )}
                    </Dropdown>
                  </>
                ) : (
                  <>
                    {!styleState.isMobile && (
                      <>
                        <Nav.Item
                          itemKey={'login'}
                          text={!styleState.isMobile ? t('登录') : null}
                          icon={<IconUser style={headerIconStyle} />}
                        />
                        {
                          // Hide register option in self-use mode
                          !styleState.isMobile && !isSelfUseMode && (
                            <Nav.Item
                              itemKey={'register'}
                              text={t('注册')}
                              icon={<IconKey style={headerIconStyle} />}
                            />
                          )
                        }
                      </>
                    )}
                  </>
                )}
              </>
            }
          ></Nav>
        </div>
      </Layout>
      {styleState.isMobile && renderMobileNavDrawer()}
    </>
  );
};

export default HeaderBar;
