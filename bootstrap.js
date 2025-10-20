var AnnotationColorCustomizer;

// 统一的日志系统 - 在bootstrap中最先定义
var ACCLogger = {
    // 调试日志配置
    debugConfig: {
        enabled: true,
        categories: '', // 专门调试自定义颜色问题相关的类别
        availableCategories: [
            'init',           // 初始化相关
            'pref_get_set',   // 偏好设置读写
            'tooltip',        // tooltip相关
            'translation',    // 翻译拦截相关
            'window',         // 窗口管理相关
            'config',         // 配置加载相关
            'mode',           // 模式切换相关
            'bootstrap',      // bootstrap相关
            'pane'            // 偏好设置面板相关
        ]
    },

    // 获取console的统一方法
    getConsole: function() {
        try {
            if (typeof Zotero !== 'undefined' && Zotero.getMainWindow && Zotero.getMainWindow().console) {
                return Zotero.getMainWindow().console;
            }
        } catch (e) {
            // 如果获取console失败，返回null
        }
        return null;
    },

    // 基础日志方法
    log: function(msg) {
        const console = this.getConsole();
        if (console) {
            console.log(`[AnnotationColorCustomizer] ${msg}`);
        } else {
            // 回退到Zotero.debug
            if (typeof Zotero !== 'undefined' && Zotero.debug) {
                Zotero.debug("Annotation Color Customizer: " + msg);
            }
        }
    },

    // 调试日志方法
    debugLog: function(category, message, ...args) {
        if (!this.debugConfig.enabled) return;
        
        // 检查是否应该显示此类别的日志
        if (this.debugConfig.categories !== '*') {
            const enabledCategories = this.debugConfig.categories.split(',').map(c => c.trim());
            if (!enabledCategories.includes(category)) return;
        }
        
        const prefix = `[ACC-${category.toUpperCase()}]`;
        const fullMessage = `${prefix} ${message}`;
        
        const console = this.getConsole();
        if (console) {
            console.log(fullMessage, ...args);
        } else {
            // 回退到Zotero.debug
            if (typeof Zotero !== 'undefined' && Zotero.debug) {
                Zotero.debug(fullMessage);
                if (args.length > 0) {
                    Zotero.debug(`${prefix} Args: ${JSON.stringify(args)}`);
                }
            }
        }
    },

    // 设置调试日志类别
    setDebugCategories: function(categories) {
        this.debugConfig.categories = categories;
        this.debugLog('config', `调试日志类别已设置为: ${categories}`);
    },

    // 启用/禁用调试日志
    setDebugEnabled: function(enabled) {
        this.debugConfig.enabled = enabled;
        const message = `调试日志已${enabled ? '启用' : '禁用'}`;
        this.debugLog('config', message);
    },

    // 便捷的调试控制方法
    setDebug: function(enabled, categories = '*') {
        this.setDebugEnabled(enabled);
        this.setDebugCategories(categories);
        this.debugLog('init', `调试日志已${enabled ? '启用' : '禁用'}，类别: ${categories}`);
    },

    // 显示可用的调试类别
    showDebugCategories: function() {
        const console = this.getConsole();
        if (console) {
            console.log('可用的调试类别:', this.debugConfig.availableCategories.join(', '));
            console.log('当前启用的类别:', this.debugConfig.categories);
            console.log('调试状态:', this.debugConfig.enabled ? '启用' : '禁用');
        }
    }
};

// 为了向后兼容，保留原来的log函数
function log(msg) {
    ACCLogger.log(msg);
}

function install() {
    log("Installed");
}

async function startup({ id, version, rootURI }) {
    log("Starting " + version);
    // 将ACCLogger注册到全局，供其他脚本使用
    if (typeof Zotero !== 'undefined') {
        Zotero.ACCLogger = ACCLogger;
        ACCLogger.debugLog('bootstrap', '[TEMP_DEBUG] ACCLogger已注册到 Zotero.ACCLogger');
    }
    
    log("[TEMP_DEBUG] Plugin ID: " + id);
    log("[TEMP_DEBUG] Root URI: " + rootURI);
    
    // Fluent localization files are automatically registered by Zotero 7
    // No need for manual chrome registration for .ftl files
    log("[TEMP_DEBUG] Using Fluent localization - no manual registration needed");
    
    // Register preference pane using Zotero 7 official method
    try {
        log("[TEMP_DEBUG] Attempting to register preference pane...");
        log("[TEMP_DEBUG] Pane src: " + rootURI + "content/pane.xhtml");
        log("[TEMP_DEBUG] Pane script: " + rootURI + "content/pane.js");
        
        Zotero.PreferencePanes.register({
            pluginID: id,
            src: rootURI + "content/pane.xhtml",
            scripts: [rootURI + "content/pane.js"],
            stylesheets: [rootURI + "skin/preferences.css"],
            label: "Annotation Color Customizer",
            image: rootURI + "icons/icon-32.svg",
            helpURL: "https://github.com/aidecameron/zotero-annotation-color-customizer"
        });
        log("[TEMP_DEBUG] Preference pane registration completed successfully");
        log("Preference pane registered");
        
        // 验证注册是否成功
        log("[TEMP_DEBUG] Checking registered panes...");
        const registeredPanes = Zotero.PreferencePanes.getAll();
        log("[TEMP_DEBUG] Total registered panes: " + registeredPanes.length);
        const ourPane = registeredPanes.find(pane => pane.pluginID === id);
        log("[TEMP_DEBUG] Our pane found: " + (ourPane ? 'YES' : 'NO'));
        if (ourPane) {
            log("[TEMP_DEBUG] Our pane details: " + JSON.stringify({
                pluginID: ourPane.pluginID,
                src: ourPane.src,
                scripts: ourPane.scripts,
                label: ourPane.label
            }));
        }
    } catch (e) {
        log("[TEMP_DEBUG] Preference pane registration failed: " + e.message);
        log("[TEMP_DEBUG] Error stack: " + e.stack);
    }
    
    // Load main functionality
    try {
        log("[TEMP_DEBUG] Loading main functionality script...");
        Services.scriptloader.loadSubScript(rootURI + 'content/annotationColorCustomizer.js');
        log("[TEMP_DEBUG] Script loaded, initializing...");
        AnnotationColorCustomizer.init({ id, version, rootURI });
        log("[TEMP_DEBUG] Adding to all windows...");
        AnnotationColorCustomizer.addToAllWindows();
        log("[TEMP_DEBUG] Calling main function...");
        await AnnotationColorCustomizer.main();
        log("[TEMP_DEBUG] Main functionality loaded successfully");
    } catch (e) {
        log("[TEMP_DEBUG] Main functionality loading failed: " + e.message);
        log("[TEMP_DEBUG] Error stack: " + e.stack);
    }
}

function onMainWindowLoad({ window }) {
    AnnotationColorCustomizer.addToWindow(window);
}

function onMainWindowUnload({ window }) {
    AnnotationColorCustomizer.removeFromWindow(window);
}

function shutdown() {
    log("Shutting down");
    
    AnnotationColorCustomizer.removeFromAllWindows();
    AnnotationColorCustomizer.cleanup();
    
    // 清理全局日志对象
    if (typeof Zotero !== 'undefined' && Zotero.ACCLogger) {
        delete Zotero.ACCLogger;
        log("ACCLogger cleaned up from global Zotero object");
    }
}

function uninstall() {
    log("Uninstalling plugin...");
    
    // 确保彻底清理
    if (AnnotationColorCustomizer) {
        try {
            AnnotationColorCustomizer.removeFromAllWindows();
            AnnotationColorCustomizer.cleanup();
            log("Plugin cleanup completed");
        } catch (e) {
            log("Error during cleanup: " + e.message);
        }
    }
    
    // 清理全局日志对象
    if (typeof Zotero !== 'undefined' && Zotero.ACCLogger) {
        delete Zotero.ACCLogger;
        log("ACCLogger cleaned up from global Zotero object during uninstall");
    }
    
    log("Uninstalled");
}