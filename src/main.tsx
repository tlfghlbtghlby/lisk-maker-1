import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { setupNativeApp } from './utils/nativeSetup';

// تهيئة تطبيق الأندرويد (شريط الحالة...) ولا أثر لها خارجه
void setupNativeApp();

createRoot(document.getElementById('root')!).render(<App />);
