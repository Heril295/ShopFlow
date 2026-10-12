import React, { useState } from 'react';
import { ShoppingBag, CheckCircle2, AlertOctagon, ArrowRight, Loader2, CreditCard, Shield, ExternalLink } from 'lucide-react';
import { DistributedTrace } from '../types/shopflow';

interface ShopperCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: (sku: string, price: number) => { trace: DistributedTrace; success: boolean; errorReason?: string };
  onViewTrace: (traceId: string) => void;
}

const ITEMS = [
  { sku: 'sku-101', name: 'UltraNoise Wireless ANC Headphones', price: 299.99, category: 'Audio' },
  { sku: 'sku-102', name: 'ProMech Mechanical Keyboard RGB', price: 149.50, category: 'Peripherals' },
  { sku: 'sku-103', name: '4K Curved Gaming Monitor 165Hz', price: 499.00, category: 'Displays' }
];

export const ShopperCheckoutModal: React.FC<ShopperCheckoutModalProps> = ({
  isOpen,
  onClose,
  onCheckout,
  onViewTrace
}) => {
  const [selectedSku, setSelectedSku] = useState<string>('sku-101');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [result, setResult] = useState<{ trace: DistributedTrace; success: boolean; errorReason?: string } | null>(null);

  if (!isOpen) return null;

  const currentItem = ITEMS.find(i => i.sku === selectedSku) || ITEMS[0];

  const handleRunCheckout = () => {
    setIsProcessing(true);
    setResult(null);
    setStepIndex(1);

    setTimeout(() => {
      setStepIndex(2);
      setTimeout(() => {
        setStepIndex(3);
        setTimeout(() => {
          const outcome = onCheckout(currentItem.sku, currentItem.price);
          setResult(outcome);
          setIsProcessing(false);
          setStepIndex(4);
        }, 600);
      }, 500);
    }, 400);
  };

  const steps = [
    { num: 1, label: 'Gateway Ingress', svc: 'api-gateway' },
    { num: 2, label: 'Stock Lock', svc: 'inventory-service' },
    { num: 3, label: 'Payment Auth', svc: 'payment-service' },
    { num: 4, label: 'Outbox Event', svc: 'order-service' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-slate-100 text-lg">ShopFlow Live Shopper Simulator</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>

        {/* Item Selector */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            Select Product to Purchase:
          </label>
          <div className="grid grid-cols-1 gap-2">
            {ITEMS.map(item => (
              <div
                key={item.sku}
                onClick={() => setSelectedSku(item.sku)}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  selectedSku === item.sku
                    ? 'border-indigo-500 bg-indigo-950/30 ring-1 ring-indigo-500/50'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold text-slate-200 text-sm">{item.name}</div>
                  <div className="text-xs text-slate-400 font-mono">SKU: {item.sku} | Category: {item.category}</div>
                </div>
                <div className="font-mono font-bold text-slate-100 text-sm">
                  ${item.price.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment & Security simulated badge */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-400" />
            <span>Simulated Visa •••• 4242</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Shield className="w-3.5 h-3.5" />
            <span>OTel Trace Context Injected</span>
          </div>
        </div>

        {/* Step Progression Visualizer */}
        {isProcessing && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                Executing checkout transaction...
              </span>
              <span>Step {stepIndex} of 4</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {steps.map(s => (
                <div
                  key={s.num}
                  className={`p-2 rounded-lg text-center text-[10px] font-mono border ${
                    stepIndex >= s.num
                      ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300 font-bold'
                      : 'border-slate-800 bg-slate-900 text-slate-500'
                  }`}
                >
                  <div>{s.label}</div>
                  <div className="text-[9px] text-slate-400">{s.svc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Result Feedback */}
        {result && (
          <div
            className={`p-4 rounded-xl border space-y-3 ${
              result.success
                ? 'border-emerald-500/80 bg-emerald-950/20 text-emerald-300'
                : 'border-rose-500/80 bg-rose-950/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {result.success ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Order Confirmed! Total: ${currentItem.price} (HTTP 201)</span>
                </>
              ) : (
                <>
                  <AlertOctagon className="w-5 h-5 text-rose-500" />
                  <span>Checkout Aborted: {result.errorReason}</span>
                </>
              )}
            </div>

            <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-slate-800/80">
              <span className="text-slate-400">Duration: {result.trace.totalDurationMs}ms</span>
              <button
                onClick={() => {
                  onClose();
                  onViewTrace(result.trace.traceId);
                }}
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
              >
                <span>Inspect Trace ({result.trace.traceId})</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleRunCheckout}
            disabled={isProcessing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-mono font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95 transition-all shadow-md shadow-indigo-950/50 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running Pipeline...</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" />
                <span>Place Order &amp; Test Flow</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
