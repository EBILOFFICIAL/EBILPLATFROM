import logo from '../../assets/logo.png';

export default function Logo({ className = 'h-9' }) {
  return <img src={logo} alt="EIBIL - Employee Information Base of India" className={`${className} w-auto object-contain`} data-testid="eibil-logo" />;
}
