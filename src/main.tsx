import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installNativeDialogFix } from './utils/nativeDialogFix';
import { installNumpadFix } from './utils/numpadFix';
import { installModalKeyGuard } from './utils/modalKeyGuard';

installNativeDialogFix();
installNumpadFix();
installModalKeyGuard();

createRoot(document.getElementById('root')!).render(<App />);
