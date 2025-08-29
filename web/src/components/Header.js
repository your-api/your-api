import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserContext } from '../context/User/index.jsx';
import { StatusContext } from '../context/Status/index.jsx';
import { useSetTheme, useTheme } from '../context/Theme/index.jsx';
import { API, getLogo, getSystemName, showSuccess } from '../helpers/index.js';
import {
  Avatar,
  Button,
  Dropdown,
  Nav,
} from '@douyinfe/semi-ui';
import {
  IconSun,
  IconMoon,
} from '@douyinfe/semi-icons';

const Header = () => {
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState, statusDispatch] = useContext(StatusContext);
  const systemName = getSystemName();
  const logo = getLogo();
  const navigate = useNavigate();
  const theme = useTheme();
  const setTheme = useSetTheme();

  async function logout() {
    await API.get('/api/user/logout');
    showSuccess('注销成功!');
    userDispatch({ type: 'logout' });
    localStorage.removeItem('user');
    navigate('/login');
  }

  const renderAvatar = (small = false) => {
    if (userState.user) {
      return (
        <Dropdown
          position="bottomRight"
          render={
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => navigate('/setting')}>设置</Dropdown.Item>
              <Dropdown.Item onClick={logout}>注销</Dropdown.Item>
            </Dropdown.Menu>
          }
        >
          <Avatar size="small" color={'lime'} style={{ margin: 4 }}>
            {userState.user.username[0].toUpperCase()}
          </Avatar>
          <span>{userState.user.username}</span>
        </Dropdown>
      );
    } else {
      return (
        <div>
          <Button
            theme="solid"
            type="primary"
            onClick={() => navigate('/login')}
            size="small"
          >
            登录
          </Button>
        </div>
      );
    }
  };

  return (
    <div style={{ height: 60 }}>
      <Nav
        mode="horizontal"
        defaultSelectedKeys={['home']}
        style={{ height: '100%' }}
        header={{
          logo: <img src={logo} alt='logo' style={{ height: 36 }} />,
          text: systemName,
        }}
        footer={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button
              icon={theme === 'dark' ? <IconSun /> : <IconMoon />}
              onClick={() => setTheme(theme === 'dark' ? false : true)}
              theme="borderless"
              style={{ marginRight: 8 }}
            />
            {renderAvatar()}
          </div>
        }
      >
        <Nav.Item itemKey="home" text="首页" link="/" />
        <Nav.Item itemKey="channel" text="渠道" link="/channel" />
        <Nav.Item itemKey="token" text="令牌" link="/token" />
        <Nav.Item itemKey="redemption" text="兑换" link="/redemption" />
        <Nav.Item itemKey="topup" text="充值" link="/topup" />
        <Nav.Item itemKey="user" text="用户" link="/user" />
        <Nav.Item itemKey="log" text="日志" link="/log" />
        <Nav.Item itemKey="setting" text="设置" link="/setting" />
        <Nav.Item itemKey="pricing" text="价格" link="/pricing" />
        <Nav.Item itemKey="about" text="关于" link="/about" />
      </Nav>
    </div>
  );
};

export default Header;