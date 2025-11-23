/**
 * Copyright (c) 2025 Focal Deploy. All Rights Reserved.
 * Licensed under the Focal Deploy Proprietary License.
 */

import { redirect } from 'next/navigation';

export default function PrivacyRedirect() {
  redirect('/legal/privacy');
}
