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

/*
  统一计算模型筛选后的各种集合与动态计数，供多个组件复用
*/
import { useMemo } from 'react';

export const usePricingFilterCounts = ({
  models = [],
  filterGroup = 'all',
  filterQuotaType = 'all',
  filterEndpointType = 'all',
  filterVendor = 'all',
  searchValue = '',
}) => {
  // 所有模型（不再需要分类过滤）
  const allModels = models;

  // 针对计费类型按钮计数
  const quotaTypeModels = useMemo(() => {
    let result = allModels;
    if (filterGroup !== 'all') {
      result = result.filter(m => m.enable_groups && m.enable_groups.includes(filterGroup));
    }
    if (filterEndpointType !== 'all') {
      result = result.filter(m =>
        m.supported_endpoint_types && m.supported_endpoint_types.includes(filterEndpointType)
      );
    }
    if (filterVendor !== 'all') {
      if (filterVendor === 'unknown') {
        result = result.filter(m => !m.vendor_name);
      } else {
        result = result.filter(m => m.vendor_name === filterVendor);
      }
    }
    return result;
  }, [allModels, filterGroup, filterEndpointType, filterVendor]);

  // 针对端点类型按钮计数
  const endpointTypeModels = useMemo(() => {
    let result = allModels;
    if (filterGroup !== 'all') {
      result = result.filter(m => m.enable_groups && m.enable_groups.includes(filterGroup));
    }
    if (filterQuotaType !== 'all') {
      result = result.filter(m => m.quota_type === filterQuotaType);
    }
    if (filterVendor !== 'all') {
      if (filterVendor === 'unknown') {
        result = result.filter(m => !m.vendor_name);
      } else {
        result = result.filter(m => m.vendor_name === filterVendor);
      }
    }
    return result;
  }, [allModels, filterGroup, filterQuotaType, filterVendor]);

  // === 可用令牌分组计数模型（排除 group 过滤，保留其余过滤） ===
  const groupCountModels = useMemo(() => {
    let result = allModels;

    // 不应用 filterGroup 本身
    if (filterQuotaType !== 'all') {
      result = result.filter(m => m.quota_type === filterQuotaType);
    }
    if (filterEndpointType !== 'all') {
      result = result.filter(m =>
        m.supported_endpoint_types && m.supported_endpoint_types.includes(filterEndpointType)
      );
    }
    if (filterVendor !== 'all') {
      if (filterVendor === 'unknown') {
        result = result.filter(m => !m.vendor_name);
      } else {
        result = result.filter(m => m.vendor_name === filterVendor);
      }
    }
    if (searchValue && searchValue.length > 0) {
      const term = searchValue.toLowerCase();
      result = result.filter(m =>
        m.model_name.toLowerCase().includes(term) ||
        (m.description && m.description.toLowerCase().includes(term)) ||
        (m.tags && m.tags.toLowerCase().includes(term)) ||
        (m.vendor_name && m.vendor_name.toLowerCase().includes(term))
      );
    }
    return result;
  }, [allModels, filterQuotaType, filterEndpointType, filterVendor, searchValue]);

  // 针对供应商按钮计数
  const vendorModels = useMemo(() => {
    let result = allModels;
    if (filterGroup !== 'all') {
      result = result.filter(m => m.enable_groups && m.enable_groups.includes(filterGroup));
    }
    if (filterQuotaType !== 'all') {
      result = result.filter(m => m.quota_type === filterQuotaType);
    }
    if (filterEndpointType !== 'all') {
      result = result.filter(m =>
        m.supported_endpoint_types && m.supported_endpoint_types.includes(filterEndpointType)
      );
    }
    return result;
  }, [allModels, filterGroup, filterQuotaType, filterEndpointType]);

  return {
    quotaTypeModels,
    endpointTypeModels,
    vendorModels,
    groupCountModels,
  };
}; 