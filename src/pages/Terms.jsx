import React from 'react';
import { useNavigate } from 'react-router-dom';
import mrMonopolyImg from '../mrMonopoly.png';
import './Terms.css';

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="terms-page">
      {/* Background Blobs */}
      <div className="bg-blob bg-blob--pink"></div>
      <div className="bg-blob bg-blob--beige"></div>
      <div className="bg-blob bg-blob--purple"></div>

      {/* Header */}
      <header className="terms-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="header-brand">
          <img src={mrMonopolyImg} alt="Mr. Monopoly" className="header-logo" draggable="false" />
          <span className="header-title">Mono<span>Pay</span></span>
        </div>
        <div style={{ width: 44 }}></div>
      </header>

      {/* Content */}
      <main className="terms-content">
        <h1 className="page-title">Terms & Conditions</h1>
        <p className="last-updated">Last updated: January 17, 2026</p>

        <section className="terms-section">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using MonoPay ("the App"), you agree to be bound by these Terms and Conditions. 
            If you do not agree to these terms, please do not use the App.
          </p>
        </section>

        <section className="terms-section">
          <h2>2. Description of Service</h2>
          <p>
            MonoPay is a fan-made companion web application designed to facilitate cashless transactions 
            during Monopoly board game sessions. The App allows players to:
          </p>
          <ul>
            <li>Create and join virtual game rooms</li>
            <li>Track in-game currency and transactions</li>
            <li>Manage property purchases and rent payments</li>
            <li>View game statistics and history</li>
          </ul>
        </section>

        <section className="terms-section">
          <h2>3. User Accounts</h2>
          <p>
            To use certain features of the App, you must create an account. You are responsible for:
          </p>
          <ul>
            <li>Maintaining the confidentiality of your account credentials</li>
            <li>All activities that occur under your account</li>
            <li>Notifying us immediately of any unauthorized use</li>
          </ul>
        </section>

        <section className="terms-section">
          <h2>4. Virtual Currency</h2>
          <p>
            All currency within MonoPay is virtual and has no real-world monetary value. 
            The virtual currency is solely for entertainment purposes during Monopoly game sessions 
            and cannot be exchanged, transferred, or redeemed for real money or items of value.
          </p>
        </section>

        <section className="terms-section">
          <h2>5. User Conduct</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the App for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to any part of the App</li>
            <li>Interfere with or disrupt the App's functionality</li>
            <li>Impersonate any person or entity</li>
            <li>Use automated means to access the App without permission</li>
          </ul>
        </section>

        <section className="terms-section">
          <h2>6. Intellectual Property</h2>
          <p>
            MonoPay is a fan-made project and is not affiliated with, endorsed by, or connected to 
            Hasbro Inc. or MONOPOLY®. MONOPOLY® is a registered trademark of Hasbro Inc.
          </p>
          <p>
            All original content, features, and functionality of MonoPay are owned by the developers 
            and are protected by applicable intellectual property laws.
          </p>
        </section>

        <section className="terms-section">
          <h2>7. Privacy</h2>
          <p>
            Your use of the App is also governed by our Privacy Policy. We collect and use your 
            information only as described in that policy. By using the App, you consent to such 
            collection and use.
          </p>
        </section>

        <section className="terms-section">
          <h2>8. Disclaimer of Warranties</h2>
          <p>
            The App is provided "as is" and "as available" without warranties of any kind, 
            either express or implied. We do not guarantee that the App will be uninterrupted, 
            secure, or error-free.
          </p>
        </section>

        <section className="terms-section">
          <h2>9. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, we shall not be liable for any indirect, 
            incidental, special, consequential, or punitive damages arising from your use of the App.
          </p>
        </section>

        <section className="terms-section">
          <h2>10. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will notify users of any 
            material changes by posting the new Terms on this page. Your continued use of the App 
            after such modifications constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section className="terms-section">
          <h2>11. Contact Us</h2>
          <p>
            If you have any questions about these Terms & Conditions, please contact us through 
            the App's support channels.
          </p>
        </section>

        <footer className="terms-footer">
          <p>Fan-made Monopoly Companion WebApp</p>
          <p>Not affiliated with or endorsed by Hasbro MONOPOLY®</p>
        </footer>
      </main>
    </div>
  );
};

export default Terms;
