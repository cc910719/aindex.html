/**
 * 物资管理API
 * @fileoverview 处理物资相关的CRUD操作
 */

import { Database, KEYS } from './db.js';

/**
 * 设置CORS头部
 * @param {Response} response - 响应对象
 * @returns {Response} 设置了CORS的响应
 */
function setCorsHeaders(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

/**
 * 处理物资管理请求
 * @param {Request} request - 请求对象
 * @returns {Promise<Response>} 响应对象
 */
export default async function handler(request) {
  // 处理OPTIONS请求（CORS预检）
  if (request.method === 'OPTIONS') {
    return setCorsHeaders(new Response(null, { status: 200 }));
  }

  const url = new URL(request.url);
  const method = request.method;
  
  try {
    switch (method) {
      case 'GET':
        return setCorsHeaders(await handleGet(url));
      case 'POST':
        return setCorsHeaders(await handlePost(request));
      case 'PUT':
        return setCorsHeaders(await handlePut(request, url));
      case 'DELETE':
        return setCorsHeaders(await handleDelete(url));
      default:
        return setCorsHeaders(new Response('Method not allowed', { status: 405 }));
    }
  } catch (error) {
    console.error('API错误:', error);
    return setCorsHeaders(new Response(JSON.stringify({ 
      error: '服务器内部错误',
      message: error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' }
    }));
  }
}

/**
 * 处理GET请求 - 获取物资列表
 * @param {URL} url - 请求URL
 * @returns {Promise<Response>} 响应对象
 */
async function handleGet(url) {
  const action = url.searchParams.get('action');
  
  switch (action) {
    case 'list':
      const items = await Database.get(KEYS.EMERGENCY_ITEMS);
      return new Response(JSON.stringify({ success: true, data: items }), {
        headers: { 'Content-Type': 'application/json' }
      });
    
    case 'stats':
      const allItems = await Database.get(KEYS.EMERGENCY_ITEMS);
      const stats = calculateStats(allItems);
      return new Response(JSON.stringify({ success: true, data: stats }), {
        headers: { 'Content-Type': 'application/json' }
      });
    
    default:
      return new Response(JSON.stringify({ error: '无效的操作' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
  }
}

/**
 * 处理POST请求 - 添加新物资
 * @param {Request} request - 请求对象
 * @returns {Promise<Response>} 响应对象
 */
async function handlePost(request) {
  const data = await request.json();
  
  // 验证必填字段
  if (!data.name || !data.category || data.quantity === undefined) {
    return new Response(JSON.stringify({ 
      error: '缺少必填字段',
      required: ['name', 'category', 'quantity'] 
    }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 创建新物资记录
  const newItem = {
    id: Date.now().toString(),
    name: data.name,
    category: data.category,
    quantity: parseInt(data.quantity),
    unit: data.unit || '个',
    spec: data.spec || '',
    price: parseFloat(data.price) || 0,
    source: data.source || '',
    date: data.date || new Date().toISOString().split('T')[0],
    operator: data.operator || 'system',
    usage: data.usage || '',
    notes: data.notes || '',
    totalValue: (parseInt(data.quantity) || 0) * (parseFloat(data.price) || 0),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const success = await Database.add(KEYS.EMERGENCY_ITEMS, newItem);
  
  if (success) {
    // 记录操作日志
    await Database.logOperation(
      '添加物资',
      `添加物资: ${newItem.name}, 数量: ${newItem.quantity}${newItem.unit}`,
      newItem.operator
    );

    return new Response(JSON.stringify({ 
      success: true, 
      data: newItem,
      message: '物资添加成功' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } else {
    return new Response(JSON.stringify({ error: '添加物资失败' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理PUT请求 - 更新物资信息
 * @param {Request} request - 请求对象
 * @param {URL} url - 请求URL
 * @returns {Promise<Response>} 响应对象
 */
async function handlePut(request, url) {
  const id = url.searchParams.get('id');
  if (!id) {
    return new Response(JSON.stringify({ error: '缺少物资ID' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const updates = await request.json();
  updates.updatedAt = new Date().toISOString();
  
  // 重新计算总价值
  if (updates.quantity !== undefined || updates.price !== undefined) {
    const items = await Database.get(KEYS.EMERGENCY_ITEMS);
    const item = items.find(i => i.id === id);
    if (item) {
      const quantity = updates.quantity !== undefined ? updates.quantity : item.quantity;
      const price = updates.price !== undefined ? updates.price : item.price;
      updates.totalValue = quantity * price;
    }
  }

  const success = await Database.update(KEYS.EMERGENCY_ITEMS, id, updates);
  
  if (success) {
    // 记录操作日志
    await Database.logOperation(
      '更新物资',
      `更新物资ID: ${id}`,
      updates.operator || 'system'
    );

    return new Response(JSON.stringify({ 
      success: true,
      message: '物资更新成功' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } else {
    return new Response(JSON.stringify({ error: '更新物资失败' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 处理DELETE请求 - 删除物资
 * @param {URL} url - 请求URL
 * @returns {Promise<Response>} 响应对象
 */
async function handleDelete(url) {
  const id = url.searchParams.get('id');
  if (!id) {
    return new Response(JSON.stringify({ error: '缺少物资ID' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const success = await Database.delete(KEYS.EMERGENCY_ITEMS, id);
  
  if (success) {
    // 记录操作日志
    await Database.logOperation(
      '删除物资',
      `删除物资ID: ${id}`,
      'system'
    );

    return new Response(JSON.stringify({ 
      success: true,
      message: '物资删除成功' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } else {
    return new Response(JSON.stringify({ error: '删除物资失败' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * 计算物资统计信息
 * @param {Array} items - 物资列表
 * @returns {Object} 统计信息
 */
function calculateStats(items) {
  const stats = {
    totalItems: items.length,
    totalValue: 0,
    categories: {},
    lowStock: []
  };

  items.forEach(item => {
    // 计算总价值
    stats.totalValue += item.totalValue || 0;
    
    // 分类统计
    if (!stats.categories[item.category]) {
      stats.categories[item.category] = { count: 0, value: 0 };
    }
    stats.categories[item.category].count++;
    stats.categories[item.category].value += item.totalValue || 0;
    
    // 低库存提醒（库存少于5的物资）
    if (item.quantity < 5) {
      stats.lowStock.push({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit
      });
    }
  });

  return stats;
} 