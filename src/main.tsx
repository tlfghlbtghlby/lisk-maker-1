import {createRoot} from 'react-dom/client';
import CustomerDisplay from './components/CustomerDisplay';
import { isCustomerDisplayRoute } from './utils/customerDisplay';
import App from './App.tsx';
import './index.css';
import { installNativeDialogFix } from './utils/nativeDialogFix';
import { installNumpadFix } from './utils/numpadFix';
import { installModalKeyGuard } from './utils/modalKeyGuard';
import { installThemeCustom } from './utils/themeCustom';
import { installAutoContrast } from './utils/autoContrast';
import { installModernMode } from './utils/modernMode';
import { installUiScale } from './utils/uiScale';
import { installPremiumButtons } from './utils/premiumButtons';
import { installDeskMode } from './utils/uiMode';
import './desk.css';
import { installModalScroll, installPopupClamp } from './utils/modalScroll';
import './modern.css';

installNativeDialogFix();
installNumpadFix();
installModalKeyGuard();
installThemeCustom();
installAutoContrast();
installModernMode();
installDeskMode();
installUiScale();
installPremiumButtons();
installModalScroll();
installPopupClamp();

// الشاشة الثانية للزبون: صفحة خفيفة مستقلة بلا حسابات ولا بيانات المتجر
createRoot(document.getElementById('root')!).render(isCustomerDisplayRoute() ? <CustomerDisplay /> : <App />);
