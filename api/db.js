/**
 * Vercel KV 数据库连接和工具函数
 * @fileoverview 物资库管理系统数据库操作
 */

import { kv } from '@vercel/kv';

// 数据键名常量
const KEYS = {
  EMERGENCY_ITEMS: 'emergency_items',
  OUTBOUND_RECORDS: 'outbound_records', 
  RETURN_RECORDS: 'return_records',
  BORROW_RECORDS: 'borrow_records',
  OPERATION_LOGS: 'operation_logs',
  DATA_BACKUPS: 'data_backups'
};

/**
 * 通用数据库操作类
 */
class Database {
  /**
   * 获取数据
   * @param {string} key - 数据键名
   * @returns {Promise<Array>} 数据数组
   */
  static async get(key) {
    try {
      const data = await kv.get(key);
      return data || [];
    } catch (error) {
      console.error(`获取数据失败 ${key}:`, error);
      return [];
    }
  }

  /**
   * 设置数据
   * @param {string} key - 数据键名
   * @param {Array} data - 数据数组
   * @returns {Promise<boolean>} 操作结果
   */
  static async set(key, data) {
    try {
      await kv.set(key, data);
      return true;
    } catch (error) {
      console.error(`设置数据失败 ${key}:`, error);
      return false;
    }
  }

  /**
   * 添加单条记录
   * @param {string} key - 数据键名
   * @param {Object} item - 记录对象
   * @returns {Promise<boolean>} 操作结果
   */
  static async add(key, item) {
    try {
      const data = await this.get(key);
      data.push(item);
      return await this.set(key, data);
    } catch (error) {
      console.error(`添加记录失败 ${key}:`, error);
      return false;
    }
  }

  /**
   * 更新记录
   * @param {string} key - 数据键名
   * @param {string} id - 记录ID
   * @param {Object} updates - 更新的字段
   * @returns {Promise<boolean>} 操作结果
   */
  static async update(key, id, updates) {
    try {
      const data = await this.get(key);
      const index = data.findIndex(item => item.id === id);
      if (index !== -1) {
        data[index] = { ...data[index], ...updates };
        return await this.set(key, data);
      }
      return false;
    } catch (error) {
      console.error(`更新记录失败 ${key}:`, error);
      return false;
    }
  }

  /**
   * 删除记录
   * @param {string} key - 数据键名
   * @param {string} id - 记录ID
   * @returns {Promise<boolean>} 操作结果
   */
  static async delete(key, id) {
    try {
      const data = await this.get(key);
      const newData = data.filter(item => item.id !== id);
      return await this.set(key, newData);
    } catch (error) {
      console.error(`删除记录失败 ${key}:`, error);
      return false;
    }
  }

  /**
   * 记录操作日志
   * @param {string} operation - 操作类型
   * @param {string} details - 操作详情
   * @param {string} operator - 操作人员
   */
  static async logOperation(operation, details, operator = 'system') {
    const log = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      operation,
      details,
      operator
    };
    await this.add(KEYS.OPERATION_LOGS, log);
  }
}

export { Database, KEYS }; 