import React, { useEffect, useState } from 'react';
import { API, showError, showSuccess } from '../helpers';
import {
  Button,
  Form,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
} from '@douyinfe/semi-ui';
import { ITEMS_PER_PAGE } from '../constants';
import { renderGroup, renderNumber, renderQuota } from '../helpers/render';
import AddUser from '../pages/User/AddUser';
import EditUser from '../pages/User/EditUser';
import { useTranslation } from 'react-i18next';

const UsersTable = () => {
  const { t } = useTranslation();

  function renderRole(role) {
    switch (role) {
      case 1:
        return <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                    style={{
                      marginLeft: '5px',
                      background: 'linear-gradient(to right, var(--semi-color-tertiary-light-default), var(--semi-color-tertiary-light-hover))',
                      color: 'var(--semi-color-tertiary)',
                      borderColor: 'var(--semi-color-tertiary-light-active)',
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}>
                      <span className="flex items-center">
                           {t('普通用户')}
                      </span>
        </div>
      case 10:
        return (
            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                 style={{
                   marginLeft: '5px',
                   background: 'linear-gradient(to right, var(--semi-color-tertiary-light-default), var(--semi-color-tertiary-light-hover))',
                   color: 'var(--semi-color-tertiary)',
                   borderColor: 'var(--semi-color-tertiary-light-active)',
                   borderWidth: '1px',
                   borderStyle: 'solid'
                 }}>
                      <span className="flex items-center">
                           {t('管理员')}
                      </span>
            </div>
        );
      case 100:
        return (
            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                 style={{
                   marginLeft: '5px',
                   background: 'linear-gradient(to right, var(--semi-color-tertiary-light-default), var(--semi-color-tertiary-light-hover))',
                   color: 'var(--semi-color-tertiary)',
                   borderColor: 'var(--semi-color-tertiary-light-active)',
                   borderWidth: '1px',
                   borderStyle: 'solid'
                 }}>
                      <span className="flex items-center">
                           {t('超级管理员')}
                      </span>
            </div>
        );
      default:
        return (
          <Tag color='red' size='large'>
            {t('未知身份')}
          </Tag>
        );
    }
  }
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
    },
    {
      title: t('用户名'),
      dataIndex: 'username',
    },
    {
      title: t('分组'),
      dataIndex: 'group',
      render: (text, record, index) => {
        return <div>{renderGroup(text)}</div>;
      },
    },
    {
      title: t('统计信息'),
      dataIndex: 'info',
      render: (text, record, index) => {
        return (
          <div>
            <Space spacing={1}>
              <Tooltip content={t('剩余额度')}>

                <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                     style={{
                       background: 'linear-gradient(to right, var(--semi-color-tertiary-light-default), var(--semi-color-tertiary-light-hover))',
                       color: 'var(--semi-color-tertiary)',
                       borderColor: 'var(--semi-color-tertiary-light-active)',
                       borderWidth: '1px',
                       borderStyle: 'solid'
                     }}>
                  <span className="flex items-center">
                      {renderQuota(record.quota)}
                  </span>
                </div>
              </Tooltip>
              <Tooltip content={t('已用额度')}>
                <div  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                     style={{
                       marginLeft: '5px',
                       background: 'linear-gradient(to right, var(--semi-color-tertiary-light-default), var(--semi-color-tertiary-light-hover))',
                       color: 'var(--semi-color-tertiary)',
                       borderColor: 'var(--semi-color-tertiary-light-active)',
                       borderWidth: '1px',
                       borderStyle: 'solid'
                     }}>
                  <span className="flex items-center">
                      {renderQuota(record.used_quota)}
                  </span>
                </div>
              </Tooltip>
              <Tooltip content={t('调用次数')}>
                <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                     style={{
                       marginLeft: '5px',
                       background: 'linear-gradient(to right, var(--semi-color-tertiary-light-default), var(--semi-color-tertiary-light-hover))',
                       color: 'var(--semi-color-tertiary)',
                       borderColor: 'var(--semi-color-tertiary-light-active)',
                       borderWidth: '1px',
                       borderStyle: 'solid'
                     }}>
                  <span className="flex items-center">
                      {renderNumber(record.request_count)}
                  </span>
                </div>
              </Tooltip>
            </Space>
          </div>
        );
      },
    },
    {
      title: t('邀请信息'),
      dataIndex: 'invite',
      render: (text, record, index) => {
        return (
          <div>
            <Space spacing={1}>
              <Tooltip content={t('邀请人数')}>

                <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                     style={{
                       marginLeft: '5px',
                       background: 'linear-gradient(to right, var(--semi-color-tertiary-light-default), var(--semi-color-tertiary-light-hover))',
                       color: 'var(--semi-color-tertiary)',
                       borderColor: 'var(--semi-color-tertiary-light-active)',
                       borderWidth: '1px',
                       borderStyle: 'solid'
                     }}>
                  <span className="flex items-center">
                      {renderNumber(record.aff_count)}
                  </span>
                </div>


              </Tooltip>
              <Tooltip content={t('邀请总收益')}>
                <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                     style={{
                       marginLeft: '5px',
                       background: 'linear-gradient(to right, var(--semi-color-tertiary-light-default), var(--semi-color-tertiary-light-hover))',
                       color: 'var(--semi-color-tertiary)',
                       borderColor: 'var(--semi-color-tertiary-light-active)',
                       borderWidth: '1px',
                       borderStyle: 'solid'
                     }}>
                  <span className="flex items-center">
                       {renderQuota(record.aff_history_quota)}
                  </span>
                </div>
              </Tooltip>
              <Tooltip content={t('邀请人ID')}>
                {record.inviter_id === 0 ? (
                    <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                         style={{
                           marginLeft: '5px',
                           background: 'linear-gradient(to right, var(--semi-color-tertiary-light-default), var(--semi-color-tertiary-light-hover))',
                           color: 'var(--semi-color-tertiary)',
                           borderColor: 'var(--semi-color-tertiary-light-active)',
                           borderWidth: '1px',
                           borderStyle: 'solid'
                         }}>
                      <span className="flex items-center">
                           {t('无')}
                      </span>
                    </div>
                ) : (
                    <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                         style={{
                             marginLeft: '5px',
                             background: 'linear-gradient(to right, var(--semi-color-tertiary-light-default), var(--semi-color-tertiary-light-hover))',
                             color: 'var(--semi-color-tertiary)',
                             borderColor: 'var(--semi-color-tertiary-light-active)',
                             borderWidth: '1px',
                             borderStyle: 'solid'
                         }}>
                      <span className="flex items-center">
                           {record.inviter_id}
                      </span>
                    </div>
                )}
              </Tooltip>
              <Tooltip content={t('用户邀请码')}>
                <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                     style={{
                       marginLeft: '5px',
                       background: 'linear-gradient(to right, var(--semi-color-info-light-default), var(--semi-color-info-light-hover))',
                       color: 'var(--semi-color-info)',
                       borderColor: 'var(--semi-color-info-light-active)',
                       borderWidth: '1px',
                       borderStyle: 'solid'
                     }}>
                  <span className="flex items-center">
                    {record.aff_code || t('无邀请码')}
                  </span>
                </div>
              </Tooltip>
            </Space>
          </div>
        );
      },
    },
    {
      title: t('注册IP'),
      dataIndex: 'register_ip',
      render: (text, record, index) => {
        return (
          <div>
            <Tooltip content={t('用户注册时的IP地址')}>
              <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                   style={{
                     background: 'linear-gradient(to right, var(--semi-color-tertiary-light-default), var(--semi-color-tertiary-light-hover))',
                     color: 'var(--semi-color-tertiary)',
                     borderColor: 'var(--semi-color-tertiary-light-active)',
                     borderWidth: '1px',
                     borderStyle: 'solid'
                   }}>
                <span className="flex items-center">
                  {record.register_ip || t('未知')}
                </span>
              </div>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: t('角色'),
      dataIndex: 'role',
      render: (text, record, index) => {
        return <div>{renderRole(text)}</div>;
      },
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (text, record, index) => {
        return (
          <div>
            {record.DeletedAt !== null ? (
                <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                     style={{
                       marginLeft: '5px',
                       background: 'linear-gradient(to right, var(--semi-color-tertiary-light-default), var(--semi-color-tertiary-light-hover))',
                       color: 'var(--semi-color-tertiary)',
                       borderColor: 'var(--semi-color-tertiary-light-active)',
                       borderWidth: '1px',
                       borderStyle: 'solid'
                     }}>
                      <span className="flex items-center">
                           {t('已注销')}
                      </span>
                </div>
            ) : (
              renderStatus(text)
            )}
          </div>
        );
      },
    },
    {
      title: '',
      dataIndex: 'operate',
      render: (text, record, index) => (
        <div>
          {record.DeletedAt !== null ? (
            <></>
          ) : (
            <>
              <Popconfirm
                title={t('确定？')}
                okType={'warning'}
                onConfirm={() => {
                  manageUser(record.id, 'promote', record);
                }}
              >
                <Button theme='light' type='warning' style={{ marginRight: 1 }}>
                  {t('提升')}
                </Button>
              </Popconfirm>
              <Popconfirm
                title={t('确定？')}
                okType={'warning'}
                onConfirm={() => {
                  manageUser(record.id, 'demote', record);
                }}
              >
                <Button
                  theme='light'
                  type='secondary'
                  style={{ marginRight: 1 }}
                >
                  {t('降级')}
                </Button>
              </Popconfirm>
              {record.status === 1 ? (
                <Button
                  theme='light'
                  type='warning'
                  style={{ marginRight: 1 }}
                  onClick={async () => {
                    manageUser(record.id, 'disable', record);
                  }}
                >
                  {t('禁用')}
                </Button>
              ) : (
                <Button
                  theme='light'
                  type='secondary'
                  style={{ marginRight: 1 }}
                  onClick={async () => {
                    manageUser(record.id, 'enable', record);
                  }}
                  disabled={record.status === 3}
                >
                  {t('启用')}
                </Button>
              )}
              <Button
                theme='light'
                type='tertiary'
                style={{ marginRight: 1 }}
                onClick={() => {
                  setEditingUser(record);
                  setShowEditUser(true);
                }}
              >
                {t('编辑')}
              </Button>
              <Popconfirm
                title={t('确定是否要注销此用户？')}
                content={t('相当于删除用户，此修改将不可逆')}
                okType={'danger'}
                position={'left'}
                onConfirm={() => {
                  manageUser(record.id, 'delete', record).then(() => {
                    removeRecord(record.id);
                  });
                }}
              >
                <Button theme='light' type='danger' style={{ marginRight: 1 }}>
                  {t('注销')}
                </Button>
              </Popconfirm>
            </>
          )}
        </div>
      ),
    },
  ];

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchGroup, setSearchGroup] = useState('');
  const [searchInviteCode, setSearchInviteCode] = useState('');
  const [groupOptions, setGroupOptions] = useState([]);
  const [userCount, setUserCount] = useState(ITEMS_PER_PAGE);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState({
    id: undefined,
  });

  const removeRecord = (key) => {
    let newDataSource = [...users];
    if (key != null) {
      let idx = newDataSource.findIndex((data) => data.id === key);

      if (idx > -1) {
        // update deletedAt
        newDataSource[idx].DeletedAt = new Date();
        setUsers(newDataSource);
      }
    }
  };

  const setUserFormat = (users) => {
    for (let i = 0; i < users.length; i++) {
      users[i].key = users[i].id;
    }
    setUsers(users);
  };

  const loadUsers = async (startIdx, pageSize) => {
    const res = await API.get(`/api/user/?p=${startIdx}&page_size=${pageSize}`);
    const { success, message, data } = res.data;
    if (success) {
      const newPageData = data.items;
      setActivePage(data.page);
      setUserCount(data.total);
      setUserFormat(newPageData);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers(0, pageSize)
      .then()
      .catch((reason) => {
        showError(reason);
      });
    fetchGroups().then();
  }, []);

  const manageUser = async (userId, action, record) => {
    const res = await API.post('/api/user/manage', {
      id: userId,
      action,
    });
    const { success, message } = res.data;
    if (success) {
      showSuccess('操作成功完成！');
      let user = res.data.data;
      let newUsers = [...users];
      if (action === 'delete') {
      } else {
        record.status = user.status;
        record.role = user.role;
      }
      setUsers(newUsers);
    } else {
      showError(message);
    }
  };

  const renderStatus = (status) => {
    switch (status) {
      case 1:
        return <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                    style={{
                      marginLeft: '5px',
                      background: 'linear-gradient(to right, var(--semi-color-tertiary-light-default), var(--semi-color-tertiary-light-hover))',
                      color: 'var(--semi-color-tertiary)',
                      borderColor: 'var(--semi-color-tertiary-light-active)',
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }}>
                      <span className="flex items-center">
                           {t('已激活')}
                      </span>
        </div>
      case 2:
        return (
            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm"
                 style={{
                   marginLeft: '5px',
                   background: 'linear-gradient(to right, var(--semi-color-tertiary-light-default), var(--semi-color-tertiary-light-hover))',
                   color: 'var(--semi-color-tertiary)',
                   borderColor: 'var(--semi-color-tertiary-light-active)',
                   borderWidth: '1px',
                   borderStyle: 'solid'
                 }}>
                      <span className="flex items-center">
                           {t('已封禁')}
                      </span>
            </div>
        );
      default:
        return (
          <Tag size='large' color='grey'>
            {t('未知状态')}
          </Tag>
        );
    }
  };

  const searchUsers = async (
    startIdx,
    pageSize,
    searchKeyword,
    searchGroup,
    searchInviteCode,
  ) => {
    if (searchKeyword === '' && searchGroup === '' && searchInviteCode === '') {
      // if keyword is blank, load files instead.
      await loadUsers(startIdx, pageSize);
      return;
    }
    setSearching(true);
    const res = await API.get(
      `/api/user/search?keyword=${searchKeyword}&group=${searchGroup}&invite_code=${searchInviteCode}&p=${startIdx}&page_size=${pageSize}`,
    );
    const { success, message, data } = res.data;
    if (success) {
      const newPageData = data.items;
      setActivePage(data.page);
      setUserCount(data.total);
      setUserFormat(newPageData);
    } else {
      showError(message);
    }
    setSearching(false);
  };

  const handleKeywordChange = async (value) => {
    setSearchKeyword(value.trim());
  };

  const handlePageChange = (page) => {
    setActivePage(page);
    if (searchKeyword === '' && searchGroup === '' && searchInviteCode === '') {
      loadUsers(page, pageSize).then();
    } else {
      searchUsers(page, pageSize, searchKeyword, searchGroup, searchInviteCode).then();
    }
  };

  const closeAddUser = () => {
    setShowAddUser(false);
  };

  const closeEditUser = () => {
    setShowEditUser(false);
    setEditingUser({
      id: undefined,
    });
  };

  const refresh = async () => {
    setActivePage(1);
    if (searchKeyword === '' && searchInviteCode === '') {
      await loadUsers(activePage, pageSize);
    } else {
      await searchUsers(activePage, pageSize, searchKeyword, searchGroup, searchInviteCode);
    }
  };

  const fetchGroups = async () => {
    try {
      let res = await API.get(`/api/group/`);
      // add 'all' option
      // res.data.data.unshift('all');
      if (res === undefined) {
        return;
      }
      setGroupOptions(
        res.data.data.map((group) => ({
          label: group,
          value: group,
        })),
      );
    } catch (error) {
      showError(error.message);
    }
  };

  const handlePageSizeChange = async (size) => {
    localStorage.setItem('page-size', size + '');
    setPageSize(size);
    setActivePage(1);
    loadUsers(activePage, size)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  };

  return (
    <>
      <AddUser
        refresh={refresh}
        visible={showAddUser}
        handleClose={closeAddUser}
      ></AddUser>
      <EditUser
        refresh={refresh}
        visible={showEditUser}
        handleClose={closeEditUser}
        editingUser={editingUser}
      ></EditUser>
      <Form
        onSubmit={() => {
          searchUsers(activePage, pageSize, searchKeyword, searchGroup, searchInviteCode);
        }}
        labelPosition='left'
      >
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <Tooltip
            content={t('支持搜索用户的 ID、用户名、显示名称、邮箱地址和注册IP')}
            style={{ marginRight: 8 }}
          >
            <Form.Input
              label={t('搜索关键字')}
              icon='search'
              field='keyword'
              iconPosition='left'
              placeholder={t('搜索关键字')}
              value={searchKeyword}
              loading={searching}
              onChange={(value) => handleKeywordChange(value)}
            />
          </Tooltip>

          <Form.Select
            style={{ marginLeft: 8, marginRight: 8 }}
            field='group'
            label={t('分组')}
            optionList={groupOptions}
            onChange={(value) => {
              setSearchGroup(value);
              searchUsers(activePage, pageSize, searchKeyword, value, searchInviteCode);
            }}
          />
          <Tooltip
            content={t('根据邀请码搜索用户')}
            style={{ marginLeft: 8, marginRight: 8 }}
          >
            <Form.Input
              label={t('邀请码')}
              icon='tag'
              field='inviteCode'
              iconPosition='left'
              placeholder={t('邀请码')}
              value={searchInviteCode}
              loading={searching}
              onChange={(value) => setSearchInviteCode(value.trim())}
            />
          </Tooltip>
          <div style={{ marginLeft: 8, display: 'flex', flexDirection: 'column' }}>
            <span style={{ marginBottom: '2px', height: '10px' }}>&nbsp;</span>
            <Button
              type='primary'
              htmlType='submit'
              className='btn-margin-right'
            >
              {t('查询')}
            </Button>
          </div>
          <div style={{ marginLeft: 8, display: 'flex', flexDirection: 'column' }}>
            <span style={{ marginBottom: '2px', height: '10px' }}>&nbsp;</span>
            <Button
              theme='light'
              type='primary'
              onClick={() => {
                setShowAddUser(true);
              }}
            >
              {t('添加用户')}
            </Button>
          </div>
        </div>
      </Form>

      <Table
        columns={columns}
        dataSource={users}
        pagination={{
          formatPageText: (page) =>
            t('第 {{start}} - {{end}} 条，共 {{total}} 条', {
              start: page.currentStart,
              end: page.currentEnd,
              total: users.length,
            }),
          currentPage: activePage,
          pageSize: pageSize,
          total: userCount,
          pageSizeOpts: [10, 20, 50, 100],
          showSizeChanger: true,
          onPageSizeChange: (size) => {
            handlePageSizeChange(size);
          },
          onPageChange: handlePageChange,
        }}
        loading={loading}
      />
    </>
  );
};

export default UsersTable;
