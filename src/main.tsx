import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installNativeDialogFix } from './utils/nativeDialogFix';
import { installNumpadFix } from './utils/numpadFix';
import { installModalKeyGuard } from './utils/modalKeyGuard';
import { installThemeCustom } from './utils/themeCustom';
import { installAutoContrast } from './utils/autoContrast';
import { installModernMode } from './utils/modernMode';
import { installUiScale } from './utils/uiScale';
import { installModalScroll, installPopupClamp } from './utils/modalScroll';
import './modern.css';

installNativeDialogFix();
installNumpadFix();
installModalKeyGuard();
installThemeCustom();
installAutoContrast();
installModernMode();
installUiScale();
installModalScroll();
installPopupClamp();

createRoot(document.getElementById('root')!).render(<App />);
