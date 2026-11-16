import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './android-native.css';
import './ios-native.css';
import { setupNativeApp } from './utils/nativeSetup';
import { installNativeDialogFix } from './utils/nativeDialogFix';
import { installNumpadFix } from './utils/numpadFix';
import { installModalKeyGuard } from './utils/modalKeyGuard';

// تهيئة تطبيق الأندرويد (شريط الحالة...) ولا أثر لها خارجه
void setupNativeApp();
installNativeDialogFix();
installNumpadFix();
installModalKeyGuard();

createRoot(document.getElementById('root')!).render(<App />);
