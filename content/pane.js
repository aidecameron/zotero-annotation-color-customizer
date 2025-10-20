// 在文件最开始添加立即执行的日志
(function() {
    // 尝试使用统一的日志系统
    if (typeof Zotero !== 'undefined' && Zotero.ACCLogger) {
        Zotero.ACCLogger.log("pane.js script is being loaded");
    } else if (typeof Zotero !== 'undefined' && Zotero.getMainWindow && Zotero.getMainWindow().console) {
        Zotero.getMainWindow().console.log("[TEMP_DEBUG] pane.js script is being loaded");
    }
})();

// 偏好设置界面的 JavaScript 代码

// 获取统一的日志系统
function getLogger() {
    if (typeof Zotero !== 'undefined' && Zotero.ACCLogger) {
        return Zotero.ACCLogger;
    }
    // 如果ACCLogger不可用，返回一个简单的日志对象
    return {
        log: function(msg) {
            if (typeof Zotero !== 'undefined' && Zotero.debug) {
                Zotero.debug("Annotation Color Customizer: " + msg);
            } else {
                console.log(`[AnnotationColorCustomizer] ${msg}`);
            }
        },
        debugLog: function(category, message, ...args) {
            if (typeof Zotero !== 'undefined' && Zotero.debug) {
                Zotero.debug(`[ACC-${category.toUpperCase()}] ${message}`);
            } else {
                console.log(`[ACC-${category.toUpperCase()}] ${message}`, ...args);
            }
        }
    };
}

// 便捷的日志方法
function log(msg) {
    getLogger().log(msg);
}

function debug(category, message, ...args) {
    getLogger().debugLog(category, message, ...args);
}

// 获取本地化字符串的辅助函数 - 支持Fluent (异步版本)
async function getStringAsync(key) {
    try {
        debug('FLUENT', `Attempting to get localized string for key: ${key}`);
        
        // 方法1: 使用异步 document.l10n.formatValue
        if (typeof document !== 'undefined' && document.l10n && typeof document.l10n.formatValue === 'function') {
            try {
                debug('FLUENT', `Calling document.l10n.formatValue('${key}') async`);
                const result = await document.l10n.formatValue(key);
                debug('FLUENT', `document.l10n.formatValue('${key}') returned: "${result}" (type: ${typeof result})`);
                if (result && result !== key && result.trim()) {
                    return result.trim();
                }
            } catch (e) {
                debug('FLUENT', `document.l10n.formatValue failed for '${key}': ${e.message}`);
            }
        }
        
        // 方法2: 等待 document.l10n.ready 然后使用同步方法
        if (typeof document !== 'undefined' && document.l10n && document.l10n.ready) {
            try {
                debug('FLUENT', `Waiting for document.l10n.ready...`);
                await document.l10n.ready;
                debug('FLUENT', `document.l10n is now ready, trying formatValueSync again`);
                const result = document.l10n.formatValueSync(key);
                debug('FLUENT', `document.l10n.formatValueSync('${key}') after ready returned: "${result}"`);
                if (result && result !== key && result.trim()) {
                    return result.trim();
                }
            } catch (e) {
                debug('FLUENT', `document.l10n.formatValueSync after ready failed for '${key}': ${e.message}`);
            }
        }
        
        debug('FLUENT', `All async localization methods failed for '${key}', returning key`);
        return key;
    } catch (e) {
        debug('FLUENT', `getStringAsync function error: ${e.message}`);
        return key;
    }
}

// 获取本地化字符串的辅助函数 - 支持Fluent (同步版本，作为备选)
function getString(key) {
    try {
        debug('FLUENT', `Attempting to get localized string for key: ${key}`);
        debug('FLUENT', `document object exists: ${typeof document !== 'undefined'}`);
        debug('FLUENT', `document.l10n exists: ${typeof document !== 'undefined' && !!document.l10n}`);
        debug('FLUENT', `Zotero object exists: ${typeof Zotero !== 'undefined'}`);
        debug('FLUENT', `Zotero.Intl exists: ${typeof Zotero !== 'undefined' && !!Zotero.Intl}`);
        
        // 方法1: 尝试使用 document.l10n.formatValueSync (Fluent API)
        try {
            if (typeof document !== 'undefined' && document.l10n && typeof document.l10n.formatValueSync === 'function') {
                debug('FLUENT', `Calling document.l10n.formatValueSync('${key}')`);
                const result = document.l10n.formatValueSync(key);
                debug('FLUENT', `document.l10n.formatValueSync('${key}') returned: "${result}" (type: ${typeof result})`);
                if (result && result !== key && result.trim()) {
                    return result.trim();
                }
            } else {
                debug('FLUENT', `document.l10n.formatValueSync not available`);
            }
        } catch (e) {
            debug('FLUENT', `document.l10n.formatValueSync failed for '${key}': ${e.message}`);
        }
        
        // 方法2: 尝试使用 Zotero 的 Fluent 本地化 API
        try {
            if (typeof Zotero !== 'undefined' && Zotero.Intl && Zotero.Intl.getString) {
                debug('FLUENT', `Calling Zotero.Intl.getString('${key}')`);
                const result = Zotero.Intl.getString(key);
                debug('FLUENT', `Zotero.Intl.getString('${key}') returned: "${result}" (type: ${typeof result})`);
                if (result && result !== key && result.trim()) {
                    return result.trim();
                }
            } else {
                debug('FLUENT', `Zotero.Intl.getString not available`);
            }
        } catch (e) {
            debug('FLUENT', `Zotero.Intl.getString failed for '${key}': ${e.message}`);
        }
        
        // 方法3: 尝试检查 document.l10n 的状态
        if (typeof document !== 'undefined' && document.l10n) {
            debug('FLUENT', `document.l10n.ready state: ${document.l10n.ready}`);
            debug('FLUENT', `Available methods on document.l10n: ${Object.getOwnPropertyNames(document.l10n)}`);
        }
        
        // 最后回退到key本身
        debug('FLUENT', `All localization methods failed for '${key}', returning key`);
        return key;
    } catch (e) {
        debug('FLUENT', `getString function error: ${e.message}`);
        return key;
    }
}

Zotero.AnnotationColorCustomizerPreferences = {
    initialized: false, // 添加初始化标志
    
    // 翻译值与内部标识的映射
    modeMapping: {
        // 内部标识 -> 翻译键
        internal: {
            'custom': 'acc-custom-translation',
            'default': 'acc-system-default'
        },
        // 翻译值 -> 内部标识 (运行时构建)
        translated: {}
    },

    // 构建翻译映射
    buildTranslationMapping() {
        log('[TEMP_DEBUG] 构建翻译映射...');
        this.modeMapping.translated = {};
        
        for (const [internalValue, translationKey] of Object.entries(this.modeMapping.internal)) {
            const translatedText = getString(translationKey);
            this.modeMapping.translated[translatedText] = internalValue;
            log(`[TEMP_DEBUG] 映射: "${translatedText}" -> "${internalValue}"`);
        }
        
        log('[TEMP_DEBUG] 翻译映射构建完成:', this.modeMapping.translated);
    },

    // 根据内部标识获取翻译文本
    getTranslatedText(internalValue) {
        const translationKey = this.modeMapping.internal[internalValue];
        return translationKey ? getString(translationKey) : internalValue;
    },

    // 根据翻译文本获取内部标识
    getInternalValue(translatedText) {
        return this.modeMapping.translated[translatedText] || translatedText;
    },
    // 获取主插件的默认配置
    getDefaultConfig() {
        // 尝试从主插件获取配置
        if (typeof window !== 'undefined' && window.Zotero && window.Zotero.AnnotationColorCustomizer) {
            return window.Zotero.AnnotationColorCustomizer.colorCustomConfig;
        }
        
        // 如果主插件不可用，使用本地备份配置
        return {
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
        };
    },

    init() {
        // 防止重复初始化
        if (this.initialized) {
            log('[TEMP_DEBUG] Preferences pane already initialized, skipping...');
            return;
        }
        
        log('[TEMP_DEBUG] Preferences pane init() called');
        log('[TEMP_DEBUG] Document ready state: ' + document.readyState);
        log('[TEMP_DEBUG] Document location: ' + document.location);
        
        try {
            log('[TEMP_DEBUG] Starting preferences initialization...');
            
            // 首先构建翻译映射
            this.buildTranslationMapping();
            
            // 检查必要的DOM元素
            const modeSelector = document.getElementById('mode-selector');
            const colorContainer = document.getElementById('color-config-container');
            const applyBtn = document.getElementById('apply-config-btn');
            
            log('[TEMP_DEBUG] DOM elements check:');
            log('[TEMP_DEBUG] - modeSelector: ' + (modeSelector ? 'found' : 'NOT FOUND'));
            log('[TEMP_DEBUG] - colorContainer: ' + (colorContainer ? 'found' : 'NOT FOUND'));
            log('[TEMP_DEBUG] - applyBtn: ' + (applyBtn ? 'found' : 'NOT FOUND'));
            
            if (!modeSelector || !colorContainer) {
                log('[TEMP_DEBUG] Critical DOM elements missing, aborting initialization');
                return;
            }

            // 设置模式选择器的事件监听器
            log('[TEMP_DEBUG] Setting up mode selector event listener...');
            // 注释掉 addEventListener，因为已在 XHTML 中使用 oncommand
            // modeSelector.addEventListener('command', this.onModeChange.bind(this));

            // 获取当前模式
            log('正在读取模式偏好设置...');
            let currentMode = Zotero.Prefs.get('extensions.annotationColorCustomizer.mode');
            log('读取到的原始偏好设置值: ' + currentMode + ' (类型: ' + typeof currentMode + ')');
            
            if (!currentMode) {
                currentMode = 'default';
                log('偏好设置为空，初始化为默认值: ' + currentMode);
                Zotero.Prefs.set('extensions.annotationColorCustomizer.mode', currentMode);
                log('默认值已保存到偏好设置');
            } else {
                log('Current mode from prefs: ' + currentMode);
            }

            // 初始化模式选择器的值
            if (modeSelector) {
                log('[TEMP_DEBUG] Initializing mode selector...');
                
                if (!currentMode) {
                    currentMode = 'default';
                    log('偏好设置为空，初始化为默认值: ' + currentMode);
                    Zotero.Prefs.set('extensions.annotationColorCustomizer.mode', currentMode);
                    log('默认值已保存到偏好设置');
                } else {
                    log('Current mode from prefs: ' + currentMode);
                }
                
                // 直接使用内部标识设置下拉框的值
                log('[TEMP_DEBUG] 设置下拉框值为内部标识: ' + currentMode);
                
                // 设置内部标识，让 XUL 系统匹配对应的 menuitem
                modeSelector.value = currentMode;
                
                // 不要对 menulist 本身设置 l10n 属性，让它显示选中的 menuitem 的文本
                log('[TEMP_DEBUG] Set menulist value to: ' + currentMode);
                
                // 确保选中正确的 menuitem
                const menuItems = modeSelector.querySelectorAll('menuitem');
                let foundItem = false;
                for (let item of menuItems) {
                    if (item.getAttribute('value') === currentMode) {
                        modeSelector.selectedItem = item;
                        log('[TEMP_DEBUG] Selected menuitem with value: ' + currentMode);
                        foundItem = true;
                        break;
                    }
                }
                
                // 如果找不到对应的选项，默认选择第一个
                if (!foundItem) {
                    log('[TEMP_DEBUG] 找不到对应的选项: ' + currentMode + '，回退到默认模式');
                    const firstItem = modeSelector.querySelector('menuitem[value="default"]');
                    if (firstItem) {
                        modeSelector.selectedItem = firstItem;
                        modeSelector.value = 'default';
                        Zotero.Prefs.set('extensions.annotationColorCustomizer.mode', 'default');
                        log('[TEMP_DEBUG] 回退到默认模式');
                    }
                }

                // 显式设置menulist的label以避免Fluent异步翻译导致的空白显示
                setTimeout(() => {
                    if (modeSelector.selectedItem) {
                        const selectedItem = modeSelector.selectedItem;
                        const l10nId = selectedItem.getAttribute('data-l10n-id');
                        
                        // 尝试获取翻译后的文本
                        let labelText = selectedItem.textContent || selectedItem.getAttribute('label');
                        
                        // 如果还没有翻译文本，使用备用文本
                        if (!labelText || labelText.trim() === '') {
                            if (l10nId === 'acc-custom-translation') {
                                labelText = '自定义翻译';
                            } else if (l10nId === 'acc-system-default') {
                                labelText = '系统默认';
                            } else {
                                labelText = selectedItem.getAttribute('value') || '未知';
                            }
                        }
                        
                        // 显式设置menulist的label
                        modeSelector.setAttribute('label', labelText);
                        log('[TEMP_DEBUG] Set menulist label to: ' + labelText);
                    }
                }, 100);
                
                setTimeout(() => {
                    log('[TEMP_DEBUG] Final mode selector state:');
                    log('[TEMP_DEBUG] - value: ' + modeSelector.value);
                    log('[TEMP_DEBUG] - selectedItem: ' + (modeSelector.selectedItem ? 
                        (modeSelector.selectedItem.getAttribute('data-l10n-id') || modeSelector.selectedItem.getAttribute('value') || 'found but no id/value') : 'null'));
                    log('[TEMP_DEBUG] - selectedIndex: ' + modeSelector.selectedIndex);
                    log('[TEMP_DEBUG] - itemCount: ' + modeSelector.itemCount);
                    log('[TEMP_DEBUG] - label attribute: ' + modeSelector.getAttribute('label'));
                }, 100);
            } else {
                log('Mode selector not found!');
            }

            // 初始化颜色配置界面
            log('[TEMP_DEBUG] Initializing color config UI...');
            this.initColorConfigUI();
            
            // 根据当前模式显示或隐藏颜色配置界面
            const container = document.getElementById('color-config-container');
            if (container) {
                if (currentMode === 'custom') {
                    log('[TEMP_DEBUG] Current mode is custom, showing color config UI');
                    container.style.display = '';
                } else {
                    log('[TEMP_DEBUG] Current mode is not custom (' + currentMode + '), hiding color config UI');
                    container.style.display = 'none';
                }
            }

            // 设置按钮事件监听器
            log('[TEMP_DEBUG] Setting up button listeners...');
            this.setupButtonListeners();
            
            // 标记为已初始化
            this.initialized = true;
            log('[TEMP_DEBUG] Preferences initialization completed successfully');

        } catch (e) {
            log('[TEMP_DEBUG] Error in preferences init: ' + e.message);
            log('[TEMP_DEBUG] Error stack: ' + e.stack);
        }
    },

    initColorConfigUI() {
        log('Initializing color config UI');
        
        const container = document.getElementById('color-config-container');
        if (!container) {
            log('Color config container not found!');
            return;
        }

        // 清空容器
        container.innerHTML = '';

        // 获取当前配置
        const currentConfig = this.loadColorConfig();

        // 为每种颜色创建编辑界面
        const defaultConfig = this.getDefaultConfig();
        Object.keys(defaultConfig).forEach(colorKey => {
            const config = currentConfig[colorKey] || defaultConfig[colorKey];
            const colorItem = this.createColorConfigItem(colorKey, config);
            container.appendChild(colorItem);
        });
    },

    createColorConfigItem(colorKey, config) {
        log(`Creating color config item for ${colorKey}`);
        
        const vbox = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'vbox');
        vbox.style.cssText = 'border: 1px solid #ddd; border-radius: 4px; padding: 10px; margin-bottom: 8px; background: white;';

        // 标题行（颜色方块 + 颜色名称）
        const titleHbox = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'hbox');
        titleHbox.setAttribute('align', 'center');
        titleHbox.style.cssText = 'margin-bottom: 8px;';

        const colorBox = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'hbox');
        colorBox.style.cssText = `background-color: ${config.hex}; width: 20px; height: 20px; border-radius: 3px; margin-right: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);`;

        const colorLabel = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'label');
        colorLabel.setAttribute('value', `${colorKey.toUpperCase()} (${config.hex})`);
        colorLabel.style.cssText = 'font-weight: bold; color: #333;';

        titleHbox.appendChild(colorBox);
        titleHbox.appendChild(colorLabel);

        // 名称编辑行
        const nameHbox = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'hbox');
        nameHbox.setAttribute('align', 'center');
        nameHbox.style.cssText = 'margin-bottom: 5px;';

        const nameLabel = document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', 'label');
        nameLabel.setAttribute('value', 'Name:');
        nameLabel.style.cssText = 'min-width: 50px; margin-right: 8px;';

        // 使用 html:input 替代 textbox
        const nameInput = document.createElementNS('http://www.w3.org/1999/xhtml', 'input');
        nameInput.setAttribute('id', `color-name-${colorKey}`);
        nameInput.setAttribute('type', 'text');
        nameInput.setAttribute('value', config.name);
        nameInput.style.cssText = 'flex: 1; margin-left: 10px; min-width: 200px; padding: 4px; border: 1px solid #ccc; border-radius: 4px;';

        nameHbox.appendChild(nameLabel);
        nameHbox.appendChild(nameInput);

        // 组装元素
        vbox.appendChild(titleHbox);
        vbox.appendChild(nameHbox);

        return vbox;
    },

    setupButtonListeners() {
        log('Setting up button listeners');

        // 应用设置按钮
        const applyBtn = document.getElementById('apply-config-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                log('Apply button clicked');
                this.applyColorConfig();
            });
        }
    },

    loadColorConfig() {
        try {
            const configStr = Zotero.Prefs.get('extensions.annotationColorCustomizer.colorConfig', '');
            if (configStr) {
                const config = JSON.parse(configStr);
                log('Loaded color config from preferences');
                return config;
            }
        } catch (e) {
            log('Error loading color config: ' + e.message);
        }
        
        log('Using default color config');
        return this.getDefaultConfig();
    },

    saveColorConfig(config) {
        log('[TEMP_DEBUG] ===== SAVECOLORCONFIG 开始 =====');
        log('[TEMP_DEBUG] 准备保存的配置对象:', JSON.stringify(config, null, 2));
        log('[TEMP_DEBUG] 配置对象键数量:', Object.keys(config).length);
        
        try {
            const configStr = JSON.stringify(config);
            log('[TEMP_DEBUG] 序列化后的配置字符串长度:', configStr.length);
            log('[TEMP_DEBUG] 序列化后的配置字符串:', configStr);
            
            Zotero.Prefs.set('extensions.annotationColorCustomizer.colorConfig', configStr);
            log('[TEMP_DEBUG] Zotero.Prefs.set 调用完成');
            
            // 验证保存是否成功
            const savedStr = Zotero.Prefs.get('extensions.annotationColorCustomizer.colorConfig', '');
            log('[TEMP_DEBUG] 验证保存 - 读取回的字符串长度:', savedStr.length);
            log('[TEMP_DEBUG] 验证保存 - 读取回的字符串:', savedStr);
            log('[TEMP_DEBUG] 验证保存 - 字符串是否匹配:', savedStr === configStr);
            
            log('Color config saved to preferences');
            log('[TEMP_DEBUG] ===== SAVECOLORCONFIG 结束 (成功) =====');
            return true;
        } catch (e) {
            log('[TEMP_DEBUG] 保存配置时出错: ' + e.message);
            log('[TEMP_DEBUG] 错误堆栈:', e.stack);
            log('Error saving color config: ' + e.message);
            log('[TEMP_DEBUG] ===== SAVECOLORCONFIG 结束 (失败) =====');
            return false;
        }
    },

    // 使用与主插件一致的模式检测逻辑
    getCurrentMode() {
        try {
            let mode = 'default';
            let foundMode = false;
            
            // 方法1: 直接从当前Zotero实例读取
            try {
                const rawMode = Zotero.Prefs.get('extensions.annotationColorCustomizer.mode');
                log('方法1-原始偏好设置值: ' + JSON.stringify(rawMode));
                if (rawMode && rawMode !== '') {
                    mode = rawMode;
                    foundMode = true;
                    log('方法1成功，使用模式: ' + mode);
                }
            } catch (e) {
                log('方法1失败: ' + e.message);
            }
            
            // 方法2: 如果方法1失败，尝试从主窗口读取
            if (!foundMode) {
                try {
                    const mainWindow = window.parent || window.top;
                    if (mainWindow && mainWindow.Zotero && mainWindow.Zotero.Prefs) {
                        const mainWindowMode = mainWindow.Zotero.Prefs.get('extensions.annotationColorCustomizer.mode');
                        log('方法2-从主窗口读取的模式: ' + JSON.stringify(mainWindowMode));
                        if (mainWindowMode && mainWindowMode !== '') {
                            mode = mainWindowMode;
                            foundMode = true;
                            log('方法2成功，使用模式: ' + mode);
                        }
                    }
                } catch (e) {
                    log('方法2失败: ' + e.message);
                }
            }
            
            // 方法3: 如果前两种方法都失败，尝试通过Services读取
            if (!foundMode) {
                try {
                    const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
                    const servicesMode = Services.prefs.getCharPref('extensions.annotationColorCustomizer.mode', '');
                    log('方法3-从Services读取的模式: ' + JSON.stringify(servicesMode));
                    if (servicesMode && servicesMode !== '') {
                        mode = servicesMode;
                        foundMode = true;
                        log('方法3成功，使用模式: ' + mode);
                    }
                } catch (e) {
                    log('方法3失败: ' + e.message);
                }
            }
            
            log('最终确定的模式: ' + mode + ' (找到: ' + foundMode + ')');
            return mode;
        } catch (e) {
            log('获取当前模式时发生错误: ' + e.message);
            return 'default';
        }
    },

    async applyColorConfig() {
        log('Applying color configuration...');
        
        try {
            const config = {};
            
            // 收集所有颜色的配置
            const defaultConfig = this.getDefaultConfig();
            Object.keys(defaultConfig).forEach(colorKey => {
                const nameInput = document.getElementById(`color-name-${colorKey}`);
                
                if (nameInput) {
                    config[colorKey] = {
                        hex: defaultConfig[colorKey].hex,
                        name: nameInput.value || defaultConfig[colorKey].name
                    };
                    log(`收集颜色配置 ${colorKey}: ${nameInput.value}`);
                }
            });

            log('完整的配置对象:', JSON.stringify(config, null, 2));

            // 保存配置
            const saveResult = this.saveColorConfig(config);
            log('配置保存结果:', saveResult);
            
            // 验证保存后立即读取
            const verifyConfig = this.loadColorConfig();
            log('保存后验证读取的配置:', JSON.stringify(verifyConfig, null, 2));

            // 通知主插件重新加载配置
            log('通知主插件重新加载配置');
            this.notifyMainPlugin('configReload');
            
            // 显示成功消息 - 使用Fluent国际化
            log('[TEMP_DEBUG] Attempting to get translation for acc-config-applied');
            try {
                const successMessage = await getStringAsync('acc-config-applied');
                log(`[TEMP_DEBUG] getStringAsync('acc-config-applied') returned: "${successMessage}"`);
                this.showMessage(successMessage, 'success');
            } catch (e) {
                log('[TEMP_DEBUG] Async translation failed, falling back to sync method');
                const successMessage = getString('acc-config-applied');
                log(`[TEMP_DEBUG] getString('acc-config-applied') returned: "${successMessage}"`);
                this.showMessage(successMessage, 'success');
            }
            
        } catch (e) {
            log('Error applying color config: ' + e.message);
            log('错误堆栈:', e.stack);
            this.showMessage('应用配置时出错：' + e.message, 'error');
        }
    },

    async showMessage(message, type = 'info') {
        log(`Showing message (${type}): ${message}`);
        
        try {
            // 获取国际化的标题
            let title;
            try {
                title = await getStringAsync('acc-plugin-name');
                if (!title || title === 'acc-plugin-name') {
                    title = getString('acc-plugin-name');
                }
                if (!title || title === 'acc-plugin-name') {
                    title = "注释颜色自定义器"; // 回退到硬编码
                }
            } catch (e) {
                title = "注释颜色自定义器"; // 回退到硬编码
            }
            
            // 方法1: 使用 Zotero 的通知系统 (推荐)
            if (typeof Zotero !== 'undefined' && Zotero.Notifier && Zotero.Notifier.trigger) {
                // 使用 Zotero 的内置通知系统
                const notificationType = type === 'success' ? 'success' : 'info';
                
                // 尝试使用 Zotero 的 ProgressWindow 显示通知
                if (Zotero.ProgressWindow) {
                    const progressWindow = new Zotero.ProgressWindow();
                    progressWindow.changeHeadline(title); // 使用国际化标题
                    progressWindow.addDescription(message);
                    progressWindow.show();
                    progressWindow.startCloseTimer(3000); // 3秒后自动关闭
                    return;
                }
            }
            
            // 方法2: 使用自定义标题的对话框
            const mainWindow = Zotero.getMainWindow();
            if (mainWindow && mainWindow.Services && mainWindow.Services.prompt) {
                const promptService = mainWindow.Services.prompt;
                promptService.alert(mainWindow, title, message);
                return;
            }
            
            // 方法3: 回退到原生 alert (带自定义前缀)
            if (mainWindow && mainWindow.alert) {
                // 在消息前添加标题信息
                const titleMessage = `${title}\n\n${message}`;
                mainWindow.alert(titleMessage);
                return;
            }
            
            // 最后的回退方案
            alert(`${title}: ${message}`);
            
        } catch (e) {
            log('Error showing message: ' + e.message);
            // 如果所有方法都失败，使用简单的 console.log
            console.log(`[注释颜色自定义器] ${message}`);
        }
    },

    notifyMainPlugin(action, data) {
        log('Notifying main plugin: ' + action);
        
        try {
            const mainWindow = Zotero.getMainWindow();
            if (!mainWindow) {
                log('Main window not found');
                return false;
            }

            if (action === 'configReload') {
                // 通知主插件重新加载配置
                if (typeof mainWindow.AnnotationColorCustomizer !== 'undefined') {
                    log('找到主窗口和插件实例');
                    log('调用主插件的 reloadConfig 方法');
                    const success = mainWindow.AnnotationColorCustomizer.reloadConfig();
                    log('reloadConfig 返回结果:', success);
                    return success;
                } else {
                    log('未找到主窗口或插件实例，尝试事件通知');
                    // 通过事件通知
                    const event = new mainWindow.CustomEvent('annotationColorCustomizerConfigReload', {
                        detail: data || {}
                    });
                    mainWindow.dispatchEvent(event);
                    log('已向主窗口派发事件: annotationColorCustomizerConfigReload');
                    return true;
                }
            } else if (action === 'modeChange') {
                if (typeof mainWindow.AnnotationColorCustomizer !== 'undefined') {
                    log('调用主插件的 checkModeAndInit 方法');
                    const result = mainWindow.AnnotationColorCustomizer.checkModeAndInit();
                    log('checkModeAndInit 返回结果:', result);
                    return result;
                } else {
                    const event = new mainWindow.CustomEvent('annotationColorCustomizerModeChange', {
                        detail: data || {}
                    });
                    mainWindow.dispatchEvent(event);
                    log('已向主窗口派发事件: annotationColorCustomizerModeChange');
                    return true;
                }
            }
            
            return true;
        } catch (e) {
            log('Error notifying main plugin: ' + e.message);
            log('通知主插件时出错:', e.stack);
            return false;
        }
    },
    
    onModeChange: function(event) {
        log('[TEMP_DEBUG] onModeChange 被调用');
        log('[TEMP_DEBUG] Event type: ' + event.type);
        log('[TEMP_DEBUG] Event target: ' + event.target.tagName);
        
        const modeSelector = document.getElementById('mode-selector');
        if (!modeSelector) {
            log('[TEMP_DEBUG] Mode selector not found in onModeChange');
            return;
        }
        
        // 获取选定的文本
        const selectedText = modeSelector.selectedItem ? 
            (modeSelector.selectedItem.getAttribute('label') || modeSelector.selectedItem.textContent) : 
            modeSelector.value;
        
        log('[TEMP_DEBUG] Selected text: ' + selectedText);
        log('[TEMP_DEBUG] Selected value: ' + modeSelector.value);
        log('[TEMP_DEBUG] Selected index: ' + modeSelector.selectedIndex);
        
        // 转换为内部标识
        const internalValue = modeSelector.value; // 直接使用value，因为我们设置的就是内部标识
        log('[TEMP_DEBUG] Internal value: ' + internalValue);
        
        if (!internalValue) {
            log('[TEMP_DEBUG] No internal value found, aborting mode change');
            return;
        }
        
        // 保存到偏好设置
        log('[TEMP_DEBUG] Saving mode to preferences: ' + internalValue);
        try {
            Zotero.Prefs.set('extensions.annotationColorCustomizer.mode', internalValue);
            
            // 验证保存结果
            const savedValue = Zotero.Prefs.get('extensions.annotationColorCustomizer.mode');
            log('[TEMP_DEBUG] Verified saved value: ' + savedValue);
            
            if (savedValue !== internalValue) {
                log('[TEMP_DEBUG] Warning: Saved value does not match expected value');
            }
        } catch (e) {
            log('[TEMP_DEBUG] Error saving mode preference: ' + e.message);
            return;
        }
        
        // 如果切换到自定义模式，显示颜色配置界面；否则隐藏
        const container = document.getElementById('color-config-container');
        if (container) {
            if (internalValue === 'custom') {
                log('[TEMP_DEBUG] Switching to custom mode, showing color config UI');
                container.style.display = '';
            } else {
                log('[TEMP_DEBUG] Switching to default mode, hiding color config UI');
                container.style.display = 'none';
            }
        }

        // 显式设置menulist的label以避免切换后显示空白
        setTimeout(() => {
            if (modeSelector.selectedItem) {
                const selectedItem = modeSelector.selectedItem;
                const l10nId = selectedItem.getAttribute('data-l10n-id');
                
                // 尝试获取翻译后的文本
                let labelText = selectedItem.textContent || selectedItem.getAttribute('label');
                
                // 如果还没有翻译文本，使用备用文本
                if (!labelText || labelText.trim() === '') {
                    if (l10nId === 'acc-custom-translation') {
                        labelText = '自定义翻译';
                    } else if (l10nId === 'acc-system-default') {
                        labelText = '系统默认';
                    } else {
                        labelText = selectedItem.getAttribute('value') || '未知';
                    }
                }
                
                // 显式设置menulist的label
                modeSelector.setAttribute('label', labelText);
                log('[TEMP_DEBUG] Set menulist label after mode change to: ' + labelText);
            }
        }, 50);
        
        // 通知主插件模式已更改
        log('[TEMP_DEBUG] Notifying main plugin of mode change');
        try {
            const mainWindow = Zotero.getMainWindow();
            if (mainWindow && typeof mainWindow.AnnotationColorCustomizer !== 'undefined') {
                // 直接调用主插件的方法，模式切换时需要重新加载配置
                log('[TEMP_DEBUG] 直接调用主插件的checkModeAndInit方法，重新加载配置');
                mainWindow.AnnotationColorCustomizer.checkModeAndInit(false); // 不跳过配置加载
            } else if (mainWindow) {
                // 如果主插件对象不存在，通过事件通知
                log('[TEMP_DEBUG] 通过事件通知主插件模式变更');
                const customEvent = new mainWindow.CustomEvent('annotationColorCustomizerModeChange', {
                    detail: { mode: internalValue }
                });
                mainWindow.dispatchEvent(customEvent);
            }
        } catch (e) {
            log('[TEMP_DEBUG] 通知主插件失败: ' + e.message);
        }
        
        log('[TEMP_DEBUG] Mode change completed successfully');
    }
};

// Initialize when pane loads
log("Pane script loaded, waiting for DOMContentLoaded...");

document.addEventListener('DOMContentLoaded', () => {
    log("DOMContentLoaded event fired");
    log("Document ready state: " + document.readyState);
    
    setTimeout(() => {
        log("Initializing preferences pane...");
        Zotero.AnnotationColorCustomizerPreferences.init();
    }, 100);
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    log("Document already ready, initializing immediately...");
    setTimeout(() => {
        log("Initializing preferences pane (immediate)...");
        Zotero.AnnotationColorCustomizerPreferences.init();
    }, 50);
}