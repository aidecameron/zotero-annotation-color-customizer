// Zotero 7 注释颜色自定义插件
// 功能：1. 自定义颜色选择器的 tooltip 文本  2. 自定义右键菜单中颜色相关文本的翻译

var AnnotationColorCustomizer = {
    id: null,
    version: null,
    rootURI: null,
    
    // 获取统一的日志系统
    getLogger: function() {
        if (typeof Zotero !== 'undefined' && Zotero.ACCLogger) {
            return Zotero.ACCLogger;
        }
        // 如果ACCLogger不可用，返回一个简单的日志对象
        return {
            log: function(msg) {
                if (typeof Zotero !== 'undefined' && Zotero.debug) {
                    Zotero.debug("Annotation Color Customizer: " + msg);
                }
            },
            debugLog: function(category, message, ...args) {
                if (typeof Zotero !== 'undefined' && Zotero.debug) {
                    Zotero.debug(`[ACC-${category.toUpperCase()}] ${message}`);
                }
            }
        };
    },

    // 便捷的日志方法
    log: function(msg) {
        this.getLogger().log('acc', msg);
    },

    log: function(category, msg) {
        this.getLogger().log(category, msg);
    },

    debugLog: function(category, message, ...args) {
        this.getLogger().debugLog(category, message, ...args);
    },

    // 全局状态管理
    globalState: {
        isActive: false,
        observers: new Set(),
        readerWindows: new Set(),
        windowWatcher: null,
        mainWindowObservers: new Set(),
        // 翻译相关状态
        isReaderIntercepted: false,
        readerObjectRef: null,
        originalReaderGetString: null,
        zoteroStringBundle: null
    },
    
    // 统一的颜色自定义配置
    colorCustomConfig: {
        yellow: {
            hex: '#ffd400',
            name: 'General Annotation'
        },
        red: {
            hex: '#ff6666', 
            name: 'Important Content'
        },
        green: {
            hex: '#5fb236',
            name: 'Examples & Cases'
        },
        blue: {
            hex: '#2ea8e5',
            name: 'Data & Information'
        },
        purple: {
            hex: '#a28ae5',
            name: 'Concepts & Definitions'
        },
        magenta: {
            hex: '#e56eee',
            name: 'Mind Map Nodes'
        },
        orange: {
            hex: '#f19837',
            name: 'Quotes & Sayings'
        },
        gray: {
            hex: '#aaaaaa',
            name: 'Titles & Dividers'
        }
    },
    
    init({ id, version, rootURI }) {
        this.id = id;
        this.version = version;
        this.rootURI = rootURI;
        
        // 将插件实例注册到 Zotero 对象，供偏好设置界面使用
        if (typeof Zotero !== 'undefined') {
            Zotero.AnnotationColorCustomizer = this;
            this.debugLog('init', '[TEMP_DEBUG] 插件已注册到 Zotero.AnnotationColorCustomizer');
        }
        
        // 先加载配置，再生成映射
        this.colorCustomConfig = this.loadColorConfig();
        
        // 基于加载的配置生成的颜色 tooltip 映射（用于颜色按钮）
        this.customColorTooltips = Object.fromEntries(
            Object.values(this.colorCustomConfig).map(config => [config.hex, config.name])
        );
        
        // 基于加载的配置生成的颜色名称翻译映射（用于右键菜单）
        this.debugLog('config', '[TEMP_DEBUG] 开始重新生成翻译映射...');
        this.debugLog('config', '[TEMP_DEBUG] 当前 colorCustomConfig 键值对数量:', Object.keys(this.colorCustomConfig).length);
        
        this.customColorTranslations = {};
        this.debugLog('config', '[TEMP_DEBUG] 初始化空的翻译映射对象');
        
        Object.entries(this.colorCustomConfig).forEach(([colorKey, config], index) => {
            this.debugLog('config', `[TEMP_DEBUG] 处理第 ${index + 1} 个颜色配置: ${colorKey} -> ${config.name}`);
            
            // 点号格式
            const dotKey = `general.${colorKey}`;
            this.customColorTranslations[dotKey] = config.name;
            this.debugLog('config', `[TEMP_DEBUG] 添加点号格式映射: ${dotKey} -> ${config.name}`);
            
            // 连字符格式作为备用
            const dashKey = `general-${colorKey}`;
            this.customColorTranslations[dashKey] = config.name;
            this.debugLog('config', `[TEMP_DEBUG] 添加连字符格式映射: ${dashKey} -> ${config.name}`);
        });
        
        this.debugLog('config', '[TEMP_DEBUG] 翻译映射生成完成，总计映射数量:', Object.keys(this.customColorTranslations).length);
        this.debugLog('config', '[TEMP_DEBUG] 重新生成的翻译映射:', JSON.stringify(this.customColorTranslations, null, 2));
        
        this.debugLog('init', "Initialized with config:", this.colorCustomConfig.yellow?.name || "default");
    },
    
    log(msg) {
        this.getLogger().log(msg);
    },
    
    // ==================== 阅读器窗口管理 ====================
    
    // 获取所有阅读器窗口（包括 iframe 内的实际窗口）
    getAllReaderWindows() {
        const readerWindows = [];
        
        try {
            // 方法1: 通过 Zotero.getMainWindows() 获取主窗口，然后查找活动阅读器
            const mainWindows = Zotero.getMainWindows();
            this.debugLog('window', `找到 ${mainWindows.length} 个主窗口`);
            
            for (let mainWindow of mainWindows) {
                if (mainWindow.ZoteroPane && mainWindow.ZoteroPane.getActiveReader) {
                    const activeReader = mainWindow.ZoteroPane.getActiveReader();
                    if (activeReader) {
                        this.debugLog('window', `在主窗口中找到活动阅读器`);
                        // 检查是否是 ReaderTab（有 iframe）
                        if (activeReader._iframeWindow) {
                            this.debugLog('window', `添加 ReaderTab 的 iframe 窗口`);
                            readerWindows.push(activeReader._iframeWindow);
                        }
                        // 检查是否是 ReaderWindow（独立窗口）
                        else if (activeReader._window) {
                            this.debugLog('window', `添加 ReaderWindow 的独立窗口`);
                            readerWindows.push(activeReader._window);
                        }
                    }
                }
            }
            
            // 方法2: 通过 Zotero.Reader._readers 获取所有阅读器实例
            if (Zotero.Reader && Zotero.Reader._readers) {
                this.debugLog('window', `找到 ${Zotero.Reader._readers.length} 个阅读器实例`);
                for (let reader of Zotero.Reader._readers) {
                    // 优先检查 iframe 窗口
                    if (reader._iframeWindow && reader._iframeWindow.document) {
                        this.debugLog('window', `添加阅读器实例的 iframe 窗口`);
                        readerWindows.push(reader._iframeWindow);
                    }
                    // 备选：独立窗口
                    else if (reader._window && reader._window.document) {
                        this.debugLog('window', `添加阅读器实例的独立窗口`);
                        readerWindows.push(reader._window);
                    }
                }
            }
            
            // 方法3: 在主窗口中查找 reader iframe 元素
            for (let mainWindow of mainWindows) {
                const readerIframe = mainWindow.document.getElementById('reader');
                if (readerIframe && readerIframe.contentWindow) {
                    this.debugLog('window', `在主窗口中找到 reader iframe`);
                    readerWindows.push(readerIframe.contentWindow);
                }
            }
            
            // 方法4: 通过 Services.wm 枚举所有窗口，查找阅读器窗口
            const allWindows = Services.wm.getEnumerator(null);
            while (allWindows.hasMoreElements()) {
                const win = allWindows.getNext();
                if (win.location && win.location.href) {
                    if (win.location.href.includes('reader.html') || 
                        win.location.href.includes('reader/reader.html') ||
                        win.location.href.includes('pdf-reader')) {
                        this.debugLog('window', `通过窗口枚举找到阅读器窗口: ${win.location.href}`);
                        readerWindows.push(win);
                    }
                }
            }
            
        } catch (error) {
            this.debugLog('window', `getAllReaderWindows 出错: ${error.message}`);
        }
        
        // 去重并返回
        const uniqueWindows = [...new Set(readerWindows)];
        this.debugLog('window', `总共找到 ${uniqueWindows.length} 个唯一的阅读器窗口`);
        return uniqueWindows;
    },
    
    // ==================== 直接翻译功能 ====================
    
    // 查找所有 reader 对象的函数
    findAllReaderObjects() {
        this.debugLog('translation', '开始查找所有 reader 对象...');
        const readerObjects = [];
        
        try {
            // 方法1: 从 Zotero.Reader._readers 获取所有 reader 实例
            if (typeof Zotero !== 'undefined' && Zotero.Reader && Zotero.Reader._readers) {
                this.debugLog('translation', `在 Zotero.Reader._readers 找到 ${Zotero.Reader._readers.length} 个 reader 实例`);
                readerObjects.push(...Zotero.Reader._readers);
            }
            
            // 方法2: 从所有阅读器窗口查找 reader 对象
            const allReaderWindows = this.getAllReaderWindows();
            for (let readerWindow of allReaderWindows) {
                try {
                    // 在阅读器窗口中查找 reader 对象
                    if (readerWindow.reader && typeof readerWindow.reader._getString === 'function') {
                        this.debugLog('translation', '在阅读器窗口中找到 reader 对象');
                        readerObjects.push(readerWindow.reader);
                    }
                    
                    // 遍历窗口对象查找包含 _getString 方法的对象
                    for (let prop in readerWindow) {
                        try {
                            let obj = readerWindow[prop];
                            if (obj && typeof obj === 'object' && typeof obj._getString === 'function') {
                                this.debugLog('translation', `在 readerWindow.${prop} 找到包含 _getString 的对象`);
                                readerObjects.push(obj);
                            }
                        } catch (error) {
                            // 忽略访问错误
                        }
                    }
                } catch (error) {
                    this.debugLog('translation', `查找阅读器窗口中的 reader 对象失败: ${error.message}`);
                }
            }
            
            // 方法3: 从主窗口查找（保持向后兼容）
            const mainWindows = Zotero.getMainWindows();
            for (let mainWindow of mainWindows) {
                // 检查 window.reader
                if (mainWindow.reader && typeof mainWindow.reader._getString === 'function') {
                    this.debugLog('translation', `在主窗口中找到 reader 对象`);
                    readerObjects.push(mainWindow.reader);
                }
                
                // 遍历主窗口的属性查找包含 _getString 方法的对象
                for (let prop in mainWindow) {
                    try {
                        let obj = mainWindow[prop];
                        if (obj && typeof obj === 'object' && typeof obj._getString === 'function') {
                            this.debugLog('translation', `在主窗口的 ${prop} 属性中找到包含 _getString 的对象`);
                            readerObjects.push(obj);
                        }
                    } catch (error) {
                        // 忽略访问错误
                    }
                }
            }
            
        } catch (error) {
            this.debugLog('translation', `findAllReaderObjects 出错: ${error.message}`);
        }
        
        // 去重
        const uniqueReaders = [...new Set(readerObjects)];
        this.debugLog('translation', `总共找到 ${uniqueReaders.length} 个唯一的 reader 对象`);
        return uniqueReaders;
    },

    // 查找单个 reader 对象的函数（保持向后兼容）
    findReaderObject() {
        const allReaders = this.findAllReaderObjects();
        return allReaders.length > 0 ? allReaders[0] : null;
    },
    
    // 查找Zotero的字符串翻译系统
    findZoteroStringBundle() {
        this.debugLog('translation', '查找Zotero字符串翻译系统...');
        
        // 尝试多种方式访问Zotero的翻译系统
        const candidates = [
            () => Zotero.getString,
            () => Zotero.Utilities.getString,
            () => Zotero.Locale.getString,
            () => window.Zotero && window.Zotero.getString,
            () => {
                // 尝试访问字符串包
                if (typeof Components !== 'undefined' && Components.classes) {
                    const stringBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"]
                        .getService(Components.interfaces.nsIStringBundleService);
                    return stringBundleService.createBundle("chrome://zotero/locale/zotero.properties");
                }
                return null;
            }
        ];
        
        for (let i = 0; i < candidates.length; i++) {
            try {
                const result = candidates[i]();
                if (result && typeof result === 'function') {
                    this.log('translation', `找到翻译函数 (方法 ${i + 1})`);
                    return result;
                } else if (result && typeof result.GetStringFromName === 'function') {
                    this.log('translation', `找到字符串包 (方法 ${i + 1})`);
                    return (key) => {
                        try {
                            return result.GetStringFromName(key);
                        } catch (e) {
                            return key;
                        }
                    };
                }
            } catch (error) {
                this.log('translation', `翻译系统查找方法 ${i + 1} 失败: ${error.message}`);
            }
        }
        
        this.log('translation', '未找到Zotero翻译系统');
        return null;
    },
    
    // 直接翻译函数 - 避免递归
    directTranslate(key, ...args) {
        // 只在第一次调用时显示翻译映射，避免日志过多
        if (!this._debugMappingShown) {
            this.log('translation', `[TEMP_DEBUG] 当前翻译映射: ${JSON.stringify(this.customColorTranslations, null, 2)}`);
            this._debugMappingShown = true;
        }
        
        this.debugLog('translation', `直接翻译: key="${key}", args=[${args.join(', ')}]`);
        
        // 1. 首先检查自定义颜色映射
        if (this.customColorTranslations[key]) {
            const customResult = this.customColorTranslations[key];
            this.log('translation', `✅ 自定义映射: "${key}" -> "${customResult}"`);
            return customResult;
        }
        
        // 2. 尝试使用Zotero的翻译系统
        if (this.globalState.zoteroStringBundle) {
            try {
                const translated = this.globalState.zoteroStringBundle(key, ...args);
                if (translated && translated !== key) {
                    this.log('translation', `✅ Zotero翻译: "${key}" -> "${translated}"`);
                    return translated;
                }
            } catch (error) {
                this.log('translation', `Zotero翻译失败: ${error.message}`);
            }
        }
        
        // 3. 如果都失败，返回key本身
        this.log('translation', `⚠️ 翻译失败，返回原key: "${key}"`);
        return key;
    },
    
    // 拦截单个 reader._getString 方法
    interceptSingleReader(reader) {
        if (!reader || typeof reader._getString !== 'function') {
            this.debugLog('translation', 'reader 对象无效或没有 _getString 方法');
            return false;
        }
        
        // 检查是否已经拦截过这个 reader
        if (this.globalState.interceptedReaders && this.globalState.interceptedReaders.has(reader)) {
            this.debugLog('translation', '该 reader 已经被拦截过，跳过');
            return true;
        }
        
        this.debugLog('translation', '开始拦截单个 reader._getString 方法');
        
        // 初始化 interceptedReaders 和 originalMethods 如果不存在
        if (!this.globalState.interceptedReaders) {
            this.globalState.interceptedReaders = new Set();
        }
        if (!this.globalState.originalMethods) {
            this.globalState.originalMethods = new Map();
        }
        
        // 保存原始方法
        const originalMethod = reader._getString;
        this.globalState.originalMethods.set(reader, originalMethod);
        
        // 替换方法 - 完全避免调用原始方法
        const self = this;
        reader._getString = function(key, ...args) {
            self.log('translation', `🔄 拦截到调用: key="${key}", args=[${args.join(', ')}]`);
            
            // 直接使用我们的翻译函数，不调用原始方法
            const result = self.directTranslate(key, ...args);
            
            self.log('translation', `✅ 返回结果: "${result}"`);
            return result;
        };
        
        // 标记已拦截
        reader._getString._isIntercepted = true;
        reader._getString._originalFunc = originalMethod;
        this.globalState.interceptedReaders.add(reader);
        
        this.debugLog('translation', '成功拦截单个 reader._getString 方法');
        return true;
    },

    // 拦截所有 reader._getString 方法
    interceptAllReaders() {
        this.debugLog('translation', '开始拦截所有 reader._getString 方法...');
        
        const allReaders = this.findAllReaderObjects();
        if (allReaders.length === 0) {
            this.debugLog('translation', '未找到任何 reader 对象');
            return false;
        }
        
        // 查找Zotero翻译系统（只需要查找一次）
        if (!this.globalState.zoteroStringBundle) {
            this.globalState.zoteroStringBundle = this.findZoteroStringBundle();
        }
        
        // 初始化 interceptedReaders 如果不存在
        if (!this.globalState.interceptedReaders) {
            this.globalState.interceptedReaders = new Set();
        }
        
        let interceptedCount = 0;
        allReaders.forEach(reader => {
            // 检查是否已经拦截过这个 reader
            if (!this.globalState.interceptedReaders.has(reader)) {
                if (this.interceptSingleReader(reader)) {
                    interceptedCount++;
                }
            } else {
                this.debugLog('translation', 'reader 已被拦截，跳过');
            }
        });
        
        this.log('translation', `成功拦截了 ${interceptedCount} 个新的 reader 对象`);
        return interceptedCount > 0;
    },

    // 拦截 reader._getString 方法 - 完全避免调用原始方法（保持向后兼容）
    interceptReaderGetString() {
        if (this.globalState.interceptedReaders && this.globalState.interceptedReaders.size > 0) {
            this.debugLog('translation', '已经拦截过，尝试拦截新的 reader');
            return this.interceptAllReaders();
        }
        
        return this.interceptAllReaders();
    },
    // 恢复单个 reader 的原始翻译方法
    restoreSingleReader(reader) {
        this.debugLog('translation', '=== 开始恢复单个 reader ===');
        
        // 详细检查 reader 对象
        this.debugLog('translation', '检查 reader 对象有效性...');
        if (!reader) {
            this.debugLog('translation', 'reader 对象为 null 或 undefined，跳过');
            return false;
        }
        
        // 检查 reader 是否是 dead object
        try {
            // 尝试访问 reader 的属性来检测是否是 dead object
            const hasGetString = typeof reader._getString === 'function';
            this.debugLog('translation', `reader._getString 存在: ${hasGetString}`);
            
            // 尝试访问其他属性
            const readerType = Object.prototype.toString.call(reader);
            this.debugLog('translation', `reader 对象类型: ${readerType}`);
            
        } catch (error) {
            this.debugLog('translation', `❌ reader 对象访问失败 (可能是 dead object): ${error.message}`);
            this.debugLog('translation', `错误类型: ${error.name}`);
            
            // 如果是 dead object，从全局状态中清理引用
            try {
                this.globalState.interceptedReaders.delete(reader);
                this.globalState.originalMethods.delete(reader);
                this.debugLog('translation', '已清理 dead object 的引用');
            } catch (cleanupError) {
                this.debugLog('translation', `清理 dead object 引用失败: ${cleanupError.message}`);
            }
            return false;
        }
        
        if (!this.globalState.interceptedReaders.has(reader)) {
            this.debugLog('translation', 'reader 不在已拦截列表中，跳过');
            return false;
        }
        
        this.debugLog('translation', '恢复单个 reader 的原始方法...');
        
        const originalMethod = this.globalState.originalMethods.get(reader);
        this.debugLog('translation', `原始方法存在: ${!!originalMethod}`);
        
        if (originalMethod) {
            try {
                this.debugLog('translation', '开始重新设置 _getString 方法...');
                
                // 不再使用可能被污染的原始函数，创建新的安全翻译函数
                const zoteroTranslator = this.findZoteroStringBundle();
                if (zoteroTranslator) {
                    this.debugLog('translation', '使用 Zotero 翻译系统创建新的 _getString 方法');
                    reader._getString = function(key, ...args) {
                        try {
                            // 直接使用 Zotero 翻译系统，不调用任何可能递归的函数
                            const result = zoteroTranslator(key, ...args);
                            return result || key;
                        } catch (error) {
                            console.log(`翻译失败: ${key}`, error.message);
                            return key;
                        }
                    };
                } else {
                    this.debugLog('translation', '未找到 Zotero 翻译系统，创建回退函数');
                    // 如果找不到 Zotero 翻译系统，创建一个简单的回退函数
                    reader._getString = function(key, ...args) {
                        return key;
                    };
                }
                
                this.debugLog('translation', '_getString 方法重新设置完成');
                
            } catch (setterError) {
                this.debugLog('translation', `❌ 设置 _getString 方法失败: ${setterError.message}`);
                this.debugLog('translation', `设置错误类型: ${setterError.name}`);
                throw setterError; // 重新抛出错误以便上层捕获
            }
            
            // 清理标记和属性
            try {
                this.debugLog('translation', '开始清理标记和属性...');
                if (reader._getString) {
                    delete reader._getString._isIntercepted;
                    delete reader._getString._originalFunc;
                    this.debugLog('translation', '标记和属性清理完成');
                }
            } catch (cleanupError) {
                this.debugLog('translation', `❌ 清理标记和属性失败: ${cleanupError.message}`);
                throw cleanupError;
            }
        }
        
        // 从全局状态中移除
        try {
            this.debugLog('translation', '从全局状态中移除 reader...');
            this.globalState.interceptedReaders.delete(reader);
            this.globalState.originalMethods.delete(reader);
            this.debugLog('translation', '从全局状态移除完成');
        } catch (removeError) {
            this.debugLog('translation', `❌ 从全局状态移除失败: ${removeError.message}`);
            throw removeError;
        }
        
        this.debugLog('translation', '=== 单个 reader 恢复完成 ===');
        return true;
    },

    // 恢复所有 reader 的原始翻译方法
    restoreAllReaders() {
        this.debugLog('translation', '=== 开始恢复所有 reader 的原始翻译方法 ===');
        
        // 获取所有已拦截的 reader
        const interceptedReaders = [...this.globalState.interceptedReaders];
        this.debugLog('translation', `找到 ${interceptedReaders.length} 个已拦截的 reader`);
        
        if (interceptedReaders.length === 0) {
            this.debugLog('translation', '没有需要恢复的 reader');
            return false;
        }
        
        let successCount = 0;
        let failureCount = 0;
        
        // 恢复所有已拦截的 reader
        interceptedReaders.forEach((reader, index) => {
            this.debugLog('translation', `--- 处理第 ${index + 1}/${interceptedReaders.length} 个 reader ---`);
            
            try {
                // 先检查 reader 是否还有效
                const readerType = Object.prototype.toString.call(reader);
                this.debugLog('translation', `Reader ${index + 1} 类型: ${readerType}`);
                
                // 尝试访问 reader 的基本属性
                const hasGetString = typeof reader._getString === 'function';
                this.debugLog('translation', `Reader ${index + 1} _getString 方法存在: ${hasGetString}`);
                
                if (this.restoreSingleReader(reader)) {
                    successCount++;
                    this.debugLog('translation', `✅ Reader ${index + 1} 恢复成功`);
                } else {
                    failureCount++;
                    this.debugLog('translation', `⚠️ Reader ${index + 1} 恢复失败（可能已经恢复或无效）`);
                }
                
            } catch (error) {
                failureCount++;
                this.debugLog('translation', `❌ Reader ${index + 1} 恢复失败: ${error.message}`);
                this.debugLog('translation', `Reader ${index + 1} 错误类型: ${error.name}`);
                
                // 尝试清理有问题的 reader 引用
                try {
                    this.debugLog('translation', `尝试清理 Reader ${index + 1} 的引用...`);
                    this.globalState.interceptedReaders.delete(reader);
                    this.globalState.originalMethods.delete(reader);
                    this.debugLog('translation', `Reader ${index + 1} 引用清理完成`);
                } catch (cleanupError) {
                    this.debugLog('translation', `Reader ${index + 1} 引用清理失败: ${cleanupError.message}`);
                }
            }
        });
        
        this.debugLog('translation', `=== 恢复完成统计 ===`);
        this.debugLog('translation', `成功恢复: ${successCount} 个`);
        this.debugLog('translation', `恢复失败: ${failureCount} 个`);
        this.debugLog('translation', `剩余已拦截 reader 数量: ${this.globalState.interceptedReaders.size}`);
        this.debugLog('translation', `剩余原始方法数量: ${this.globalState.originalMethods.size}`);
        
        return successCount > 0;
    },

    restoreReaderGetString() {
        if (this.globalState.interceptedReaders && this.globalState.interceptedReaders.size === 0) {
            this.debugLog('translation', '没有被拦截的 reader，无需恢复');
            return false;
        }
        
        return this.restoreAllReaders();
    },
    
    // ==================== 颜色 Tooltip 自定义功能 ====================
    
    // 修改颜色按钮的 tooltip
    customizeColorTooltips(readerWindow) {
        if (!readerWindow || !readerWindow.document) {
            this.debugLog('tooltip', '未找到阅读器窗口');
            return false;
        }
        
        this.debugLog('tooltip', '开始自定义颜色tooltip...');
        this.debugLog('tooltip', '当前 customColorTooltips 映射:', this.customColorTooltips);
        
        const doc = readerWindow.document;
        
        // 查找颜色选择器按钮 - 尝试多种选择器
        let colorButtons = doc.querySelectorAll('.selection-popup .colors .color-button');
        
        // 如果没找到，尝试其他可能的选择器
        if (colorButtons.length === 0) {
            colorButtons = doc.querySelectorAll('.annotationPopup .colors .color-button');
        }
        if (colorButtons.length === 0) {
            colorButtons = doc.querySelectorAll('.selection-popup .color-button');
        }
        if (colorButtons.length === 0) {
            colorButtons = doc.querySelectorAll('.annotationPopup .color-button');
        }
        if (colorButtons.length === 0) {
            colorButtons = doc.querySelectorAll('.colors .color-button');
        }
        if (colorButtons.length === 0) {
            colorButtons = doc.querySelectorAll('.color-button');
        }
        if (colorButtons.length === 0) {
            colorButtons = doc.querySelectorAll('button[title*="色"], button[title*="Color"], button[title*="Yellow"], button[title*="Red"]');
        }
        if (colorButtons.length === 0) {
            // 尝试查找带有颜色样式的按钮
            colorButtons = doc.querySelectorAll('button[style*="background"], button svg[style*="fill"]');
        }
        
        if (colorButtons.length === 0) {
            this.debugLog('tooltip', '未找到颜色选择器按钮，可能需要先选择文本');
            return false;
        }
        
        this.debugLog('tooltip', `找到 ${colorButtons.length} 个颜色按钮`);
        
        let modifiedCount = 0;
        colorButtons.forEach((button, index) => {
            // 根据按钮在数组中的位置推断颜色（基于 ANNOTATION_COLORS 的顺序）
            const colorMap = [
                '#ffd400', // 黄色
                '#ff6666', // 红色
                '#5fb236', // 绿色
                '#2ea8e5', // 蓝色
                '#a28ae5', // 紫色
                '#e56eee', // 粉色
                '#f19837', // 橙色
                '#aaaaaa'  // 灰色
            ];
            
            let buttonColor = null;
            
            // 方法1: 检查内联样式
            const svgElement = button.querySelector('svg');
            if (svgElement && svgElement.style.fill) {
                buttonColor = svgElement.style.fill;
            }
            
            // 方法2: 检查按钮本身的背景色
            if (!buttonColor && button.style.backgroundColor) {
                buttonColor = button.style.backgroundColor;
            }
            
            // 方法3: 根据索引推断颜色
            if (!buttonColor && index < colorMap.length) {
                buttonColor = colorMap[index];
            }
            
            // 方法4: 从现有 title 推断颜色
            if (!buttonColor && button.title) {
                const title = button.title.toLowerCase();
                if (title.includes('yellow') || title.includes('黄')) buttonColor = '#ffd400';
                else if (title.includes('red') || title.includes('红')) buttonColor = '#ff6666';
                else if (title.includes('green') || title.includes('绿')) buttonColor = '#5fb236';
                else if (title.includes('blue') || title.includes('蓝')) buttonColor = '#2ea8e5';
                else if (title.includes('purple') || title.includes('紫')) buttonColor = '#a28ae5';
                else if (title.includes('magenta') || title.includes('粉')) buttonColor = '#e56eee';
                else if (title.includes('orange') || title.includes('橙')) buttonColor = '#f19837';
                else if (title.includes('gray') || title.includes('grey') || title.includes('灰')) buttonColor = '#aaaaaa';
            }
            
            // 如果找到了对应的自定义 tooltip，则替换
            if (buttonColor && this.customColorTooltips[buttonColor]) {
                const originalTitle = button.title;
                button.title = this.customColorTooltips[buttonColor];
                this.debugLog('tooltip', `修改按钮 ${index}: ${originalTitle} -> ${this.customColorTooltips[buttonColor]} (颜色: ${buttonColor})`);
                modifiedCount++;
            } else {
                this.debugLog('tooltip', `按钮 ${index}: 未找到匹配的颜色 (${buttonColor}), 原标题: ${button.title}`);
                this.debugLog('tooltip', `可用的tooltip映射:`, Object.keys(this.customColorTooltips));
            }
        });
        
        this.debugLog('tooltip', `成功修改了 ${modifiedCount} 个颜色按钮的 tooltip`);
        return modifiedCount > 0;
    },
    
    // 为特定的阅读器窗口设置监听器
    setupReaderWindowListener(readerWindow) {
        if (!readerWindow || !readerWindow.document) {
            return;
        }
        
        // 检查是否已经为这个窗口设置过监听器
        if (this.globalState.readerWindows.has(readerWindow)) {
            return;
        }
        
        this.globalState.readerWindows.add(readerWindow);
        
        const doc = readerWindow.document;
        
        // 创建 MutationObserver 来监听 DOM 变化
        const observer = new readerWindow.MutationObserver((mutations) => {
            let shouldCustomize = false;
            
            mutations.forEach((mutation) => {
                // 检查是否有新增的节点包含颜色按钮
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            // 检查新增的节点或其子节点是否包含颜色按钮
                            if (node.matches && (
                                node.matches('.selection-popup') ||
                                node.matches('.annotationPopup') ||
                                node.matches('.colors') ||
                                node.matches('.color-button') ||
                                node.querySelector('.color-button')
                            )) {
                                shouldCustomize = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldCustomize) {
                // 延迟执行，确保 DOM 完全更新
                setTimeout(() => {
                    this.customizeColorTooltips(readerWindow);
                }, 100);
            }
        });
        
        // 开始观察
        observer.observe(doc.body, {
            childList: true,
            subtree: true
        });
        
        this.globalState.observers.add(observer);
        
        this.debugLog('window', `为阅读器窗口设置了监听器`);
    },
    
    // ==================== 主要功能入口 ====================
    
    // 插件启用/禁用控制
    enable: function() {
        this.debugLog('mode', '[TEMP_DEBUG] ===== ENABLE 开始 =====');
        this.debugLog('mode', '[TEMP_DEBUG] 当前插件状态 - isActive:', this.globalState.isActive);
        this.debugLog('mode', '[TEMP_DEBUG] 当前翻译映射:', JSON.stringify(this.customColorTranslations, null, 2));
        this.debugLog('mode', '[TEMP_DEBUG] 当前配置:', JSON.stringify(this.colorCustomConfig, null, 2));
        
        if (this.globalState.isActive) {
            this.debugLog('init', '插件已启用，无需重复启用');
            return;
        }
        
        this.debugLog('init', '启用注释颜色自定义功能');
        
        // 完全重新加载配置（强制从偏好设置重新读取）
        this.debugLog('mode', '[TEMP_DEBUG] 强制重新加载配置...');
        const freshConfig = this.loadColorConfig();
        this.colorCustomConfig = freshConfig;
        this.debugLog('mode', '[TEMP_DEBUG] 重新加载后的配置:', JSON.stringify(this.colorCustomConfig, null, 2));
        
        // 完全重新生成翻译映射
        this.debugLog('mode', '[TEMP_DEBUG] 完全重新生成翻译映射...');
        this.customColorTranslations = {};
        Object.entries(this.colorCustomConfig).forEach(([colorKey, config]) => {
            // 点号格式
            this.customColorTranslations[`general.${colorKey}`] = config.name;
            // 连字符格式作为备用
            this.customColorTranslations[`general-${colorKey}`] = config.name;
        });
        this.debugLog('mode', '[TEMP_DEBUG] 重新生成的翻译映射:', JSON.stringify(this.customColorTranslations, null, 2));
        
        // 完全重新生成 tooltip 映射
        this.debugLog('mode', '[TEMP_DEBUG] 完全重新生成 tooltip 映射...');
        this.customColorTooltips = Object.fromEntries(
            Object.values(this.colorCustomConfig).map(config => [config.hex, config.name])
        );
        this.debugLog('mode', '[TEMP_DEBUG] 重新生成的 tooltip 映射:', JSON.stringify(this.customColorTooltips, null, 2));
        
        // 重置调试标志
        this._debugMappingShown = false;
        this.debugLog('mode', '[TEMP_DEBUG] 已重置调试标志');
        
        // 标记为活动状态
        this.globalState.isActive = true;
        
        // 重新设置翻译拦截
        this.interceptReaderGetString();
        
        // 重新设置窗口监听器
        this.setupWindowWatcher();
        
        // 获取所有reader窗口并应用配置
        const readerWindows = this.getAllReaderWindows();
        this.debugLog('mode', `[TEMP_DEBUG] 找到 ${readerWindows.length} 个reader窗口`);
        
        readerWindows.forEach((readerWindow, index) => {
            if (readerWindow && !readerWindow.closed) {
                this.debugLog('mode', `[TEMP_DEBUG] 应用配置到第 ${index + 1} 个reader窗口`);
                this.setupReaderWindowListener(readerWindow);
                this.customizeColorTooltips(readerWindow);
            }
        });
        
        this.debugLog('mode', '[TEMP_DEBUG] enable 后的状态 - isActive:', this.globalState.isActive);
        this.debugLog('mode', '[TEMP_DEBUG] enable 后的翻译映射:', JSON.stringify(this.customColorTranslations, null, 2));
        this.debugLog('mode', '[TEMP_DEBUG] ===== ENABLE 结束 =====');
        this.debugLog('init', '[TEMP_DEBUG] ✅ 注释颜色自定义功能已完全重新启用');
    },
    
    disable: function() {
        this.debugLog('mode', '[TEMP_DEBUG] ===== DISABLE 开始 =====');
        this.debugLog('mode', '[TEMP_DEBUG] 当前插件状态 - isActive:', this.globalState.isActive);
        this.debugLog('mode', '[TEMP_DEBUG] 当前翻译映射:', JSON.stringify(this.customColorTranslations, null, 2));
        this.debugLog('mode', '[TEMP_DEBUG] 当前配置:', JSON.stringify(this.colorCustomConfig, null, 2));
        
        if (!this.globalState.isActive) {
            this.debugLog('init', '插件未启用，无需禁用');
            return;
        }
        
        this.debugLog('init', '禁用注释颜色自定义功能');
        this.cleanup();
        
        this.debugLog('mode', '[TEMP_DEBUG] cleanup 后的状态 - isActive:', this.globalState.isActive);
        this.debugLog('mode', '[TEMP_DEBUG] cleanup 后的翻译映射:', JSON.stringify(this.customColorTranslations, null, 2));
        this.debugLog('mode', '[TEMP_DEBUG] ===== DISABLE 结束 =====');
    },
    
    // 检查模式并初始化
    checkModeAndInit: function(skipConfigLoad = false) {
        this.debugLog('mode', '[TEMP_DEBUG] ===== CHECKMODEANDINIT 开始 =====');
        this.debugLog('init', `检查模式并初始化，skipConfigLoad: ${skipConfigLoad}`);
        this.debugLog('mode', '[TEMP_DEBUG] 当前插件状态 - isActive:', this.globalState.isActive);
        this.debugLog('mode', '[TEMP_DEBUG] 当前翻译映射:', JSON.stringify(this.customColorTranslations, null, 2));
        
        // 获取当前模式
        let mode = null;
        
        // 方法1：从首选项获取
        try {
            mode = Zotero.Prefs.get('extensions.annotationColorCustomizer.mode');
            this.debugLog('init', `从首选项获取模式: ${mode}`);
        } catch (error) {
            this.debugLog('init', `从首选项获取模式失败: ${error.message}`);
        }
        
        // 方法2：从设置面板获取
        if (!mode) {
            try {
                const prefWindow = Services.wm.getMostRecentWindow('zotero:pref');
                if (prefWindow && prefWindow.document) {
                    const modeSelect = prefWindow.document.getElementById('annotation-color-customizer-mode');
                    if (modeSelect) {
                        mode = modeSelect.value;
                        this.debugLog('init', `从设置面板获取模式: ${mode}`);
                    }
                }
            } catch (error) {
                this.debugLog('init', `从设置面板获取模式失败: ${error.message}`);
            }
        }
        
        // 方法3：从全局变量获取
        if (!mode && typeof window !== 'undefined' && window.annotationColorCustomizerMode) {
            mode = window.annotationColorCustomizerMode;
            this.debugLog('init', `从全局变量获取模式: ${mode}`);
        }
        
        this.debugLog('init', `最终确定的模式: ${mode}`);
        this.debugLog('mode', '[TEMP_DEBUG] 最终确定的模式:', mode);
        
        // 检查是否从系统默认模式切换回自定义模式
        const wasInactive = !this.globalState.isActive;
        this.debugLog('mode', '[TEMP_DEBUG] 之前是否非活动状态 (wasInactive):', wasInactive);
        
        if (mode === 'custom') {
            this.debugLog('init', '模式为自定义，启用插件');
            this.debugLog('mode', '[TEMP_DEBUG] 模式为自定义，准备启用插件');
            
            // 无论之前状态如何，都先完全清理再重新初始化，确保状态一致性
            if (this.globalState.isActive) {
                this.debugLog('mode', '[TEMP_DEBUG] 插件当前已活动，先完全清理再重新初始化');
                this.disable();  // 完全清理
            }
            
            this.debugLog('mode', '[TEMP_DEBUG] 执行完全重新启用');
            this.enable();   // 完全重新初始化
            
        } else {
            this.debugLog('init', '模式为系统默认，禁用插件');
            this.debugLog('mode', '[TEMP_DEBUG] 模式为系统默认，执行完全禁用');
            
            if (this.globalState.isActive) {
                this.debugLog('mode', '[TEMP_DEBUG] 插件当前已活动，执行完全禁用');
                this.disable();
            } else {
                this.debugLog('mode', '[TEMP_DEBUG] 插件已禁用，无需操作');
            }
        }
        
        this.debugLog('mode', '[TEMP_DEBUG] checkModeAndInit 后的状态 - isActive:', this.globalState.isActive);
        this.debugLog('mode', '[TEMP_DEBUG] checkModeAndInit 后的翻译映射:', JSON.stringify(this.customColorTranslations, null, 2));
        this.debugLog('mode', '[TEMP_DEBUG] ===== CHECKMODEANDINIT 结束 =====');
    },
    
    async main() {
        this.debugLog('init', '开始执行主要功能...');
        
        // 检查模式并初始化
        this.checkModeAndInit();
        
        // 监听偏好设置变更事件
        try {
            const mainWindow = Zotero.getMainWindow();
            if (mainWindow) {
                // 暴露到全局以便偏好设置调用
                mainWindow.AnnotationColorCustomizer = this;
                
                // 监听模式变更事件
                mainWindow.addEventListener('annotationColorCustomizerModeChange', (event) => {
                    const mode = event.detail.mode;
                    this.debugLog('mode', '接收到模式变更事件:', mode);
                    this.checkModeAndInit(false); // 模式切换时需要重新加载配置
                });
                
                // 监听配置重新加载事件
                mainWindow.addEventListener('annotationColorCustomizerConfigReload', (event) => {
                    this.debugLog('config', '接收到配置重新加载事件');
                    const success = this.reloadConfig();
                    
                    // 通知偏好设置面板重新加载结果
                    const resultEvent = new mainWindow.CustomEvent('annotationColorCustomizerConfigReloadResult', {
                        detail: { success: success }
                    });
                    mainWindow.dispatchEvent(resultEvent);
                });
                
                // 监听偏好设置变更
                Zotero.Prefs.registerObserver('extensions.annotationColorCustomizer.mode', () => {
                    this.debugLog('mode', '偏好设置模式已变更，重新初始化...');
                    setTimeout(() => {
                        this.checkModeAndInit(true); // 跳过配置加载，避免覆盖用户配置
                    }, 100);
                });
            }
        } catch (e) {
            this.debugLog('init', '设置事件监听器失败:', e.message);
        }
    },
    
    // 设置窗口监听器来处理新打开的阅读器
    setupWindowWatcher() {
        if (this.globalState.windowWatcher) {
            return; // 已经设置过了
        }
        
        const windowWatcher = {
            observe: (subject, topic, data) => {
                if (topic === 'domwindowopened') {
                    // 延迟检查，确保窗口完全加载
                    setTimeout(() => {
                        const win = subject;
                        if (win.location && win.location.href) {
                            if (win.location.href.includes('reader.html') || 
                                win.location.href.includes('reader/reader.html') ||
                                win.location.href.includes('pdf-reader')) {
                                this.debugLog('window', '检测到新的阅读器窗口');
                                this.setupReaderWindowListener(win);
                                
                                // 重要：为新开的阅读器窗口拦截翻译功能
                                this.debugLog('window', '为新阅读器窗口拦截翻译功能...');
                                this.interceptAllReaders();
                            }
                        }
                    }, 1000);
                }
            }
        };
        
        Services.ww.registerNotification(windowWatcher);
        this.globalState.windowWatcher = windowWatcher;
        
        // 同时在主窗口中监听 iframe 或嵌入的阅读器
        const mainWindows = Zotero.getMainWindows();
        mainWindows.forEach(mainWindow => {
            if (mainWindow.document) {
                const observer = new mainWindow.MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList') {
                            mutation.addedNodes.forEach((node) => {
                                if (node.nodeType === 1) {
                                    // 检查是否是阅读器相关的元素
                                    if (node.tagName === 'IFRAME' || 
                                        (node.classList && node.classList.contains('reader')) ||
                                        (node.querySelector && node.querySelector('iframe[src*="reader"]'))) {
                                        this.debugLog('window', '检测到阅读器元素被添加');
                                        setTimeout(() => {
                                            // 重新查找所有阅读器窗口并设置监听器
                                            const allReaderWindows = this.getAllReaderWindows();
                                            allReaderWindows.forEach(readerWindow => {
                                                this.setupReaderWindowListener(readerWindow);
                                            });
                                            // 为新发现的阅读器设置翻译拦截
                                            this.debugLog('window', '为新发现的阅读器设置翻译拦截');
                                            this.interceptAllReaders();
                                        }, 1000);
                                    }
                                    
                                    // 直接在主窗口中查找颜色选择器
                                    if (node.querySelector && node.querySelector('.selection-popup .colors')) {
                                        this.debugLog('window', '在主窗口中检测到颜色选择器');
                                        setTimeout(() => {
                                            this.customizeColorTooltips(mainWindow);
                                        }, 100);
                                    }
                                }
                            });
                        }
                    });
                });
                
                observer.observe(mainWindow.document.body || mainWindow.document.documentElement, {
                    childList: true,
                    subtree: true
                });
                
                this.globalState.mainWindowObservers.add(observer);
                this.debugLog('window', '已为主窗口设置监听器');
            }
        });
        
        this.debugLog('window', '已设置窗口监听器');
    },
    
    // ==================== 窗口管理 ====================
    
    addToWindow(window) {
        // 将插件实例暴露到主窗口，以便偏好设置页面能够调用
        this.debugLog('window', '添加到主窗口');
        if (window && typeof window === 'object') {
            window.AnnotationColorCustomizer = this;
            this.debugLog('window', '插件实例已暴露到主窗口');
        }
    },
    
    removeFromWindow(window) {
        // 从主窗口移除功能（如果需要）
        this.debugLog('window', '从主窗口移除');
        if (window && typeof window === 'object' && window.AnnotationColorCustomizer === this) {
            delete window.AnnotationColorCustomizer;
            this.debugLog('window', '插件实例已从主窗口移除');
        }
    },
    
    addToAllWindows() {
        const windows = Zotero.getMainWindows();
        for (let win of windows) {
            this.addToWindow(win);
        }
    },
    
    removeFromAllWindows() {
        const windows = Zotero.getMainWindows();
        for (let win of windows) {
            this.removeFromWindow(win);
        }
    },
    
    // ==================== 清理功能 ====================
    
    cleanup() {
        this.debugLog('init', '开始清理...');
        this.debugLog('mode', '[TEMP_DEBUG] ===== CLEANUP 开始 =====');
        this.debugLog('mode', '[TEMP_DEBUG] 清理前的翻译映射:', JSON.stringify(this.customColorTranslations, null, 2));
        
        // 标记为非活动状态
        this.globalState.isActive = false;
        
        // 恢复原始翻译方法
        this.restoreReaderGetString();
        
        // 完全清空翻译映射
        this.customColorTranslations = {};
        this.debugLog('mode', '[TEMP_DEBUG] 已清空翻译映射');
        
        // 完全清空颜色 tooltip 映射
        this.customColorTooltips = {};
        this.debugLog('mode', '[TEMP_DEBUG] 已清空 tooltip 映射');
        
        // 重置调试映射显示标志
        this._debugMappingShown = false;
        this.debugLog('mode', '[TEMP_DEBUG] 已重置调试标志');
        
        // 清理所有观察器（带 dead object 检测）
        let observerSuccessCount = 0;
        let observerFailCount = 0;
        
        this.globalState.observers.forEach(observer => {
            try {
                // 检查 observer 是否为 dead object
                if (observer && typeof observer.disconnect === 'function') {
                    observer.disconnect();
                    observerSuccessCount++;
                } else {
                    this.debugLog('init', 'Observer 对象无效或缺少 disconnect 方法');
                    observerFailCount++;
                }
            } catch (error) {
                observerFailCount++;
                if (error.message && error.message.includes('dead object')) {
                    this.debugLog('init', `检测到 dead object observer: ${error.message}`);
                } else {
                    this.debugLog('init', `清理观察器时出错: ${error.message}`);
                }
            }
        });
        this.globalState.observers.clear();
        this.debugLog('init', `观察器清理完成 - 成功: ${observerSuccessCount}, 失败: ${observerFailCount}`);
        
        // 清理主窗口观察器（带 dead object 检测）
        let mainObserverSuccessCount = 0;
        let mainObserverFailCount = 0;
        
        this.globalState.mainWindowObservers.forEach(observer => {
            try {
                // 检查 observer 是否为 dead object
                if (observer && typeof observer.disconnect === 'function') {
                    observer.disconnect();
                    mainObserverSuccessCount++;
                } else {
                    this.debugLog('init', 'Main window observer 对象无效或缺少 disconnect 方法');
                    mainObserverFailCount++;
                }
            } catch (error) {
                mainObserverFailCount++;
                if (error.message && error.message.includes('dead object')) {
                    this.debugLog('init', `检测到 dead object main observer: ${error.message}`);
                } else {
                    this.debugLog('init', `清理主窗口观察器时出错: ${error.message}`);
                }
            }
        });
        this.globalState.mainWindowObservers.clear();
        this.debugLog('init', `主窗口观察器清理完成 - 成功: ${mainObserverSuccessCount}, 失败: ${mainObserverFailCount}`);
        
        // 清理窗口监听器
        if (this.globalState.windowWatcher) {
            try {
                Services.ww.unregisterNotification(this.globalState.windowWatcher);
            } catch (error) {
                this.debugLog('init', `清理窗口监听器时出错: ${error.message}`);
            }
            this.globalState.windowWatcher = null;
        }
        
        // 清理阅读器窗口集合（带 dead object 检测）
        let readerWindowSuccessCount = 0;
        let readerWindowFailCount = 0;
        
        this.globalState.readerWindows.forEach(readerWindow => {
            try {
                // 检查 readerWindow 是否为 dead object
                if (readerWindow && typeof readerWindow === 'object') {
                    // 尝试访问属性来检测 dead object
                    const testAccess = readerWindow.location;
                    
                    // 清理窗口上的自定义属性
                    if (readerWindow._colorTooltipObserver) {
                        delete readerWindow._colorTooltipObserver;
                    }
                    readerWindowSuccessCount++;
                } else {
                    this.debugLog('init', 'Reader window 对象无效');
                    readerWindowFailCount++;
                }
            } catch (error) {
                readerWindowFailCount++;
                if (error.message && error.message.includes('dead object')) {
                    this.debugLog('init', `检测到 dead object reader window: ${error.message}`);
                } else {
                    this.debugLog('init', `清理阅读器窗口时出错: ${error.message}`);
                }
            }
        });
        this.globalState.readerWindows.clear();
        this.debugLog('init', `阅读器窗口清理完成 - 成功: ${readerWindowSuccessCount}, 失败: ${readerWindowFailCount}`);
        
        // 完全重置全局状态（插件卸载时需要彻底清理）
        this.globalState.isReaderIntercepted = false;
        this.globalState.readerObjectRef = null;
        this.globalState.originalReaderGetString = null;
        this.globalState.zoteroStringBundle = null;
        
        // 输出最终清理统计
        const totalSuccess = observerSuccessCount + mainObserverSuccessCount + readerWindowSuccessCount;
        const totalFail = observerFailCount + mainObserverFailCount + readerWindowFailCount;
        this.debugLog('init', `清理统计 - 总成功: ${totalSuccess}, 总失败: ${totalFail}`);
        
        this.debugLog('mode', '[TEMP_DEBUG] 清理后的翻译映射:', JSON.stringify(this.customColorTranslations, null, 2));
        this.debugLog('mode', '[TEMP_DEBUG] ===== CLEANUP 结束 =====');
        this.debugLog('init', '✅ 清理完成（完全重置所有状态和映射）');
    },

    // 加载颜色配置（从偏好设置或使用默认值）
    loadColorConfig() {
        this.debugLog('config', '[TEMP_DEBUG] ===== LOADCOLORCONFIG 开始 =====');
        this.debugLog('config', '开始加载颜色配置...');
        
        try {
            const configStr = Zotero.Prefs.get('extensions.annotationColorCustomizer.colorConfig', '');
            this.debugLog('pref_get_set', '[TEMP_DEBUG] 从preference读取的原始字符串长度:', configStr.length);
            this.debugLog('pref_get_set', '[TEMP_DEBUG] 从preference读取的配置字符串:', configStr);
            
            if (configStr) {
                const config = JSON.parse(configStr);
                this.debugLog('config', '[TEMP_DEBUG] JSON解析成功，配置对象键数量:', Object.keys(config).length);
                this.debugLog('config', '[TEMP_DEBUG] 解析后的配置:', JSON.stringify(config, null, 2));
                this.debugLog('config', 'Loaded color config from preferences');
                this.debugLog('config', '[TEMP_DEBUG] ===== LOADCOLORCONFIG 结束 (使用preference配置) =====');
                return config;
            } else {
                this.debugLog('config', '[TEMP_DEBUG] preference配置字符串为空，将使用默认配置');
            }
        } catch (e) {
            this.debugLog('config', '[TEMP_DEBUG] 加载preference配置时出错: ' + e.message);
            this.debugLog('config', '[TEMP_DEBUG] 错误堆栈:', e.stack);
            this.debugLog('config', 'Error loading color config from preferences: ' + e.message);
        }
        
        this.debugLog('config', '[TEMP_DEBUG] 使用默认配置');
        this.debugLog('config', '[TEMP_DEBUG] 默认配置内容:', JSON.stringify(this.colorCustomConfig, null, 2));
        this.debugLog('config', 'Using default color config');
        this.debugLog('config', '[TEMP_DEBUG] ===== LOADCOLORCONFIG 结束 (使用默认配置) =====');
        return this.colorCustomConfig;
    },

    // 重新加载配置（由偏好设置面板调用）
    reloadConfig(newConfig = null) {
        this.debugLog('config', '[TEMP_DEBUG] reloadConfig 开始执行...');
        this.debugLog('config', '[TEMP_DEBUG] 传入的 newConfig:', newConfig);
        
        // 重置调试标志，确保显示新的翻译映射
        this._debugMappingShown = false;
        
        try {
            // 如果提供了新配置，使用它；否则从偏好设置加载
            const config = newConfig || this.loadColorConfig();
            this.debugLog('config', '[TEMP_DEBUG] 最终使用的配置:', JSON.stringify(config, null, 2));
            
            // 更新当前配置
            this.colorCustomConfig = config;
            this.debugLog('config', '[TEMP_DEBUG] 更新后的 colorCustomConfig:', JSON.stringify(this.colorCustomConfig, null, 2));
            
            // 重新生成颜色 tooltip 映射（用于颜色按钮）
            this.customColorTooltips = Object.fromEntries(
                Object.values(this.colorCustomConfig).map(config => [config.hex, config.name])
            );
            this.debugLog('config', '[TEMP_DEBUG] 重新生成的 tooltip 映射:', JSON.stringify(this.customColorTooltips, null, 2));
            
            // 重新生成颜色名称翻译映射（用于右键菜单）
            this.debugLog('config', '[TEMP_DEBUG] 开始重新生成翻译映射...');
            this.debugLog('config', '[TEMP_DEBUG] 当前 colorCustomConfig 键值对数量:', Object.keys(this.colorCustomConfig).length);
            
            this.customColorTranslations = {};
            this.debugLog('config', '[TEMP_DEBUG] 初始化空的翻译映射对象');
            
            Object.entries(this.colorCustomConfig).forEach(([colorKey, config], index) => {
                this.debugLog('config', `[TEMP_DEBUG] 处理第 ${index + 1} 个颜色配置: ${colorKey} -> ${config.name}`);
                
                // 点号格式
                const dotKey = `general.${colorKey}`;
                this.customColorTranslations[dotKey] = config.name;
                this.debugLog('config', `[TEMP_DEBUG] 添加点号格式映射: ${dotKey} -> ${config.name}`);
                
                // 连字符格式作为备用
                const dashKey = `general-${colorKey}`;
                this.customColorTranslations[dashKey] = config.name;
                this.debugLog('config', `[TEMP_DEBUG] 添加连字符格式映射: ${dashKey} -> ${config.name}`);
            });
            
            this.debugLog('config', '[TEMP_DEBUG] 翻译映射生成完成，总计映射数量:', Object.keys(this.customColorTranslations).length);
            this.debugLog('config', '[TEMP_DEBUG] 重新生成的翻译映射:', JSON.stringify(this.customColorTranslations, null, 2));
            
            // 强制显示新的翻译映射
            this.log('translation', `[TEMP_DEBUG] 配置重载后的翻译映射: ${JSON.stringify(this.customColorTranslations, null, 2)}`);
            
            // 如果插件当前处于活动状态，重新应用配置
            if (this.globalState.isActive) {
                this.debugLog('config', '[TEMP_DEBUG] Plugin is active, reapplying configuration to all reader windows...');
                
                // 获取所有reader窗口并重新应用配置
                const readerWindows = this.getAllReaderWindows();
                readerWindows.forEach(readerWindow => {
                    if (readerWindow && !readerWindow.closed) {
                        this.customizeColorTooltips(readerWindow);
                    }
                });
                
                this.debugLog('config', `[TEMP_DEBUG] Configuration reloaded and applied to ${readerWindows.length} reader windows`);
            } else {
                this.debugLog('config', '[TEMP_DEBUG] Plugin is not active, configuration updated but not applied');
            }
            
            this.debugLog('config', '[TEMP_DEBUG] reloadConfig 执行完成，返回 true');
            return true;
        } catch (e) {
            this.debugLog('config', '[TEMP_DEBUG] Error reloading configuration: ' + e.message);
            this.debugLog('config', '[TEMP_DEBUG] 错误堆栈:', e.stack);
            return false;
        }
    }
};