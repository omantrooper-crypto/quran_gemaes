import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './rihla.css';
class ErrorBoundary extends React.Component {constructor(props){super(props);this.state={error:false};}static getDerivedStateFromError(){return {error:true};}render(){if(this.state.error)return <main className="loading-screen"><h1>تعذّر إكمال هذه الخطوة</h1><p>أعد تحميل الصفحة؛ تبقى بياناتك المحفوظة على جهازك.</p><button className="btn" onClick={()=>location.reload()}>إعادة التحميل</button></main>;return this.props.children;}}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
