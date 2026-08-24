export type StudentCardQrSource =
  | { kind: 'data-url'; value: string }
  | { kind: 'svg'; value: string }
  | { kind: 'url'; value: string };

export type StudentCardIdentity = {
  name: string;
  code: string;
};

export type StudentCardBranding = {
  frontTitle?: string;
  frontSubtitle?: string;
  qrScanLabel?: string;
  qrFooterLabel?: string;
};
