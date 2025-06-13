/**
 * 前端API调用模块
 * @fileoverview 处理与后端API的通信，替换本地存储
 */

/**
 * API基础配置
 */
const API_BASE_URL = window.location.origin;

/**
 * API客户端类
 */
class ApiClient {
  /**
   * 发送HTTP请求
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @returns {Promise<Object>} 响应数据
   */
  static async request(url, options = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP错误: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API请求失败:', error);
      throw error;
    }
  }

  /**
   * 获取物资列表
   * @returns {Promise<Array>} 物资列表
   */
  static async getItems() {
    const response = await this.request('/api/items?action=list');
    return response.success ? response.data : [];
  }

  /**
   * 获取物资统计信息
   * @returns {Promise<Object>} 统计信息
   */
  static async getStats() {
    const response = await this.request('/api/items?action=stats');
    return response.success ? response.data : {};
  }

  /**
   * 添加新物资
   * @param {Object} itemData - 物资数据
   * @returns {Promise<Object>} 添加结果
   */
  static async addItem(itemData) {
    return await this.request('/api/items', {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  }

  /**
   * 更新物资信息
   * @param {string} id - 物资ID
   * @param {Object} updates - 更新数据
   * @returns {Promise<Object>} 更新结果
   */
  static async updateItem(id, updates) {
    return await this.request(`/api/items?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  /**
   * 删除物资
   * @param {string} id - 物资ID
   * @returns {Promise<Object>} 删除结果
   */
  static async deleteItem(id) {
    return await this.request(`/api/items?id=${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * 迁移备份数据
   * @param {Object} backupData - 备份数据
   * @returns {Promise<Object>} 迁移结果
   */
  static async migrateData(backupData) {
    return await this.request('/api/migrate', {
      method: 'POST',
      body: JSON.stringify(backupData)
    });
  }

  /**
   * 检查API连接状态
   * @returns {Promise<boolean>} 连接状态
   */
  static async checkConnection() {
    try {
      await this.request('/api/items?action=list');
      return true;
    } catch (error) {
      console.warn('API连接失败，将使用本地存储模式');
      return false;
    }
  }
}

/**
 * 数据管理器 - 统一的数据访问接口
 */
class DataManager {
  constructor() {
    this.isOnline = false;
    this.checkingConnection = false;
    this.init();
  }

  /**
   * 初始化数据管理器
   */
  async init() {
    this.isOnline = await ApiClient.checkConnection();
    console.log('数据管理器模式:', this.isOnline ? '在线模式' : '离线模式');
  }

  /**
   * 检查连接状态
   */
  async checkConnection() {
    if (this.checkingConnection) return;
    
    this.checkingConnection = true;
    try {
      this.isOnline = await ApiClient.checkConnection();
    } finally {
      this.checkingConnection = false;
    }
  }

  /**
   * 获取物资列表
   * @returns {Promise<Array>} 物资列表
   */
  async getItems() {
    if (this.isOnline) {
      try {
        return await ApiClient.getItems();
      } catch (error) {
        console.warn('API获取物资失败，切换到本地存储');
        this.isOnline = false;
        return this.getLocalItems();
      }
    }
    return this.getLocalItems();
  }

  /**
   * 添加物资
   * @param {Object} itemData - 物资数据
   * @returns {Promise<Object>} 添加结果
   */
  async addItem(itemData) {
    if (this.isOnline) {
      try {
        return await ApiClient.addItem(itemData);
      } catch (error) {
        console.warn('API添加物资失败，切换到本地存储');
        this.isOnline = false;
        return this.addLocalItem(itemData);
      }
    }
    return this.addLocalItem(itemData);
  }

  /**
   * 更新物资
   * @param {string} id - 物资ID
   * @param {Object} updates - 更新数据
   * @returns {Promise<Object>} 更新结果
   */
  async updateItem(id, updates) {
    if (this.isOnline) {
      try {
        return await ApiClient.updateItem(id, updates);
      } catch (error) {
        console.warn('API更新物资失败，切换到本地存储');
        this.isOnline = false;
        return this.updateLocalItem(id, updates);
      }
    }
    return this.updateLocalItem(id, updates);
  }

  /**
   * 删除物资
   * @param {string} id - 物资ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteItem(id) {
    if (this.isOnline) {
      try {
        return await ApiClient.deleteItem(id);
      } catch (error) {
        console.warn('API删除物资失败，切换到本地存储');
        this.isOnline = false;
        return this.deleteLocalItem(id);
      }
    }
    return this.deleteLocalItem(id);
  }

  // 本地存储方法（备用）
  getLocalItems() {
    try {
      return JSON.parse(localStorage.getItem('emergencyItems') || '[]');
    } catch (error) {
      console.error('本地存储读取失败:', error);
      return [];
    }
  }

  addLocalItem(itemData) {
    try {
      const items = this.getLocalItems();
      const newItem = {
        ...itemData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      items.push(newItem);
      localStorage.setItem('emergencyItems', JSON.stringify(items));
      return { success: true, data: newItem };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  updateLocalItem(id, updates) {
    try {
      const items = this.getLocalItems();
      const index = items.findIndex(item => item.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
        localStorage.setItem('emergencyItems', JSON.stringify(items));
        return { success: true };
      }
      return { success: false, error: '物资不存在' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  deleteLocalItem(id) {
    try {
      const items = this.getLocalItems();
      const newItems = items.filter(item => item.id !== id);
      localStorage.setItem('emergencyItems', JSON.stringify(newItems));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// 创建全局数据管理器实例
window.dataManager = new DataManager();

// 导出API类供其他模块使用
window.ApiClient = ApiClient; 