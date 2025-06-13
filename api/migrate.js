/**
 * 数据迁移API
 * @fileoverview 将JSON备份数据导入到Vercel KV数据库
 */

import { Database, KEYS } from './db.js';

/**
 * 设置CORS头部
 * @param {Response} response - 响应对象
 * @returns {Response} 设置了CORS的响应
 */
function setCorsHeaders(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

/**
 * 处理数据迁移请求
 * @param {Request} request - 请求对象
 * @returns {Promise<Response>} 响应对象
 */
export default async function handler(request) {
  // 处理OPTIONS请求（CORS预检）
  if (request.method === 'OPTIONS') {
    return setCorsHeaders(new Response(null, { status: 200 }));
  }

  if (request.method !== 'POST') {
    return setCorsHeaders(new Response(JSON.stringify({ 
      error: '只支持POST请求' 
    }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  try {
    const data = await request.json();
    
    // 验证数据格式
    if (!data || typeof data !== 'object') {
      return setCorsHeaders(new Response(JSON.stringify({ 
        error: '无效的数据格式' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    const result = await migrateData(data);
    
    return setCorsHeaders(new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    }));

  } catch (error) {
    console.error('数据迁移错误:', error);
    return setCorsHeaders(new Response(JSON.stringify({ 
      error: '数据迁移失败',
      message: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
}

/**
 * 执行数据迁移
 * @param {Object} backupData - 备份数据
 * @returns {Promise<Object>} 迁移结果
 */
async function migrateData(backupData) {
  const result = {
    success: true,
    imported: {
      emergencyItems: 0,
      outboundRecords: 0,
      returnRecords: 0,
      borrowRecords: 0,
      operationLogs: 0
    },
    errors: []
  };

  try {
    // 迁移物资数据
    if (backupData.emergencyItems && Array.isArray(backupData.emergencyItems)) {
      const items = backupData.emergencyItems.map(item => ({
        ...item,
        // 确保数据类型正确
        id: item.id ? item.id.toString() : Date.now().toString() + Math.random(),
        quantity: parseInt(item.quantity) || 0,
        price: parseFloat(item.price) || 0,
        totalValue: (parseInt(item.quantity) || 0) * (parseFloat(item.price) || 0),
        // 添加时间戳
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString()
      }));

      const success = await Database.set(KEYS.EMERGENCY_ITEMS, items);
      if (success) {
        result.imported.emergencyItems = items.length;
      } else {
        result.errors.push('物资数据导入失败');
      }
    }

    // 迁移出库记录
    if (backupData.outboundRecords && Array.isArray(backupData.outboundRecords)) {
      const records = backupData.outboundRecords.map(record => ({
        ...record,
        id: record.id ? record.id.toString() : Date.now().toString() + Math.random(),
        quantity: parseInt(record.quantity) || 0,
        createdAt: record.createdAt || new Date().toISOString()
      }));

      const success = await Database.set(KEYS.OUTBOUND_RECORDS, records);
      if (success) {
        result.imported.outboundRecords = records.length;
      } else {
        result.errors.push('出库记录导入失败');
      }
    }

    // 迁移归还记录
    if (backupData.returnRecords && Array.isArray(backupData.returnRecords)) {
      const records = backupData.returnRecords.map(record => ({
        ...record,
        id: record.id ? record.id.toString() : Date.now().toString() + Math.random(),
        quantity: parseInt(record.quantity) || 0,
        createdAt: record.createdAt || new Date().toISOString()
      }));

      const success = await Database.set(KEYS.RETURN_RECORDS, records);
      if (success) {
        result.imported.returnRecords = records.length;
      } else {
        result.errors.push('归还记录导入失败');
      }
    }

    // 迁移借用记录
    if (backupData.borrowRecords && Array.isArray(backupData.borrowRecords)) {
      const records = backupData.borrowRecords.map(record => ({
        ...record,
        id: record.id ? record.id.toString() : Date.now().toString() + Math.random(),
        quantity: parseInt(record.quantity) || 0,
        createdAt: record.createdAt || new Date().toISOString()
      }));

      const success = await Database.set(KEYS.BORROW_RECORDS, records);
      if (success) {
        result.imported.borrowRecords = records.length;
      } else {
        result.errors.push('借用记录导入失败');
      }
    }

    // 创建迁移日志
    await Database.logOperation(
      '数据迁移',
      `成功导入: 物资${result.imported.emergencyItems}条, 出库记录${result.imported.outboundRecords}条, 归还记录${result.imported.returnRecords}条, 借用记录${result.imported.borrowRecords}条`,
      'system'
    );

    // 如果有错误，标记为部分成功
    if (result.errors.length > 0) {
      result.success = false;
      result.message = '数据迁移部分失败: ' + result.errors.join(', ');
    } else {
      result.message = '数据迁移成功完成';
    }

  } catch (error) {
    result.success = false;
    result.message = '数据迁移过程中发生错误: ' + error.message;
    result.errors.push(error.message);
  }

  return result;
}

/**
 * 获取初始化数据
 * @returns {Object} 系统初始化所需的数据结构
 */
export function getInitialData() {
  return {
    emergencyItems: [
      {
        "id": "1744181823081",
        "name": "背负式四冲程 灭火器",
        "category": "消防物资",
        "quantity": 1,
        "unit": "台",
        "spec": "",
        "price": 0,
        "source": "新区拨付租借",
        "date": "2025-04-02",
        "operator": "费阳",
        "usage": "",
        "notes": "物资位置3B",
        "totalValue": 0,
        "createdAt": "2025-04-02T00:00:00.000Z",
        "updatedAt": "2025-04-02T00:00:00.000Z"
      }
      // 可以添加更多示例数据
    ],
    outboundRecords: [],
    returnRecords: [],
    borrowRecords: [],
    operationLogs: []
  };
} 