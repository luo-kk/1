const express = require('express');
const sql = require('mssql');

const app = express();
const port = 3000;

// 数据库配置
const dbConfig = {
    user: 'sa',
    password: '123456',
    server: 'localhost',
    database: 'DB_supermarket',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

// 连接到数据库
async function connectToDatabase() {
    try {
        await sql.connect(dbConfig);
        console.log('数据库连接成功！');
    } catch (err) {
        console.error('数据库连接失败:', err);
    }
}

// 获取用户购买历史
async function getUserPurchaseHistory(userID) {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('UserID', sql.Int, userID) // 防止 SQL 注入
            .query(`
                SELECT C.CommodityID, C.Name, C.ImagePath, C.Price, C.MemberPrice, C.Description, C.Type
                FROM Orders O
                JOIN Commodities C ON O.CommodityID = C.CommodityID
                WHERE O.UserID = @UserID
            `);
        console.log('查询用户购买历史成功:', result.recordset);
        return result.recordset;
    } catch (err) {
        console.error('查询用户购买历史失败:', err);
        return [];
    }
}

// 获取热门商品
async function getHotProducts() {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .query(`
                SELECT TOP 5 CommodityID, Name, ImagePath, Price, MemberPrice, Description, Type
                FROM Commodities
                ORDER BY NEWID()  -- 随机返回商品
            `);
        console.log('查询热门商品成功:', result.recordset);
        return result.recordset;
    } catch (err) {
        console.error('查询热门商品失败:', err);
        return [];
    }
}

// 获取推荐商品
async function getRecommendedProducts(userID) {
    try {
        const userHistory = await getUserPurchaseHistory(userID);

        // 如果用户没有购买历史，返回热门商品
        if (userHistory.length === 0) {
            console.log('用户没有购买历史，返回热门商品');
            return await getHotProducts();
        }

        // 获取用户购买历史商品的类型
        const types = userHistory.map(item => item.Type);

        // 如果 types 数组为空，说明没有获取到类型，直接返回热门商品
        if (types.length === 0) {
            return await getHotProducts();
        }

        // 根据购买历史的商品类型推荐相似类型的商品
        const pool = await sql.connect(dbConfig);

        // 构建 SQL 查询条件，确保 Type 之间是合法的 IN 查询
        const query = `
            SELECT TOP 5 CommodityID, Name, ImagePath, Price, MemberPrice, Description, Type
            FROM Commodities
            WHERE Type IN (${types.map(type => `'${type}'`).join(',')})
            ORDER BY NEWID()  -- 随机返回商品
        `;
        
        const result = await pool.request().query(query);
        console.log('推荐商品:', result.recordset);
        return result.recordset;
    } catch (err) {
        console.error('查询推荐商品失败:', err);
        return await getHotProducts();
    }
}

// API 路由：获取推荐商品
app.get('/api/recommended/:userID', async (req, res) => {
    const userID = parseInt(req.params.userID); // 获取用户 ID
    if (isNaN(userID)) {
        return res.status(400).json({ error: '无效的用户ID' });
    }

    const recommendedProducts = await getRecommendedProducts(userID);
    res.json({ recommendedProducts });
});

// 启动服务器
app.listen(port, async () => {
    await connectToDatabase();
    console.log(`API服务器已启动，监听端口 ${port}`);
});
