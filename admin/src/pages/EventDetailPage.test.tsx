// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { EditionDialogInner } from './EventDetailPage';
import { BilingualLangProvider } from '../contexts/BilingualLangContext';
import { EDITION_STATUS_LABELS } from '../utils/eventForms';

// #977: PR #976 (closing #970) gave EditionDialogInner's Status/Registration status Selects
// explicit labelId/id wiring so each has an accessible name reachable via getByLabelText — mirrors
// #964's fix for EventWizardPage's own EditionDetailsStep Status/Registration status Selects
// (EventWizardPage.test.tsx's getStatusCombobox/getRegistrationStatusCombobox), which already has
// a regression test. This file is the EventDetailPage half of that same follow-up: no test file
// existed for EventDetailPage at all before this.
//
// PhotoGalleryManager (rendered inside the dialog) pulls in usePhotographers, which fetches
// '/api/v1/admin/photographers' unconditionally on mount regardless of editionId — its own
// usePhotoGalleries call is gated on `enabled: !!editionId` and stays idle here (a brand-new,
// not-yet-created edition has editionId === null), but the photographers list is not, so the
// mock below still needs to answer that endpoint.
vi.mock('../hooks/api', () => ({
  apiFetch: vi.fn(() => Promise.resolve([])),
}));

// Mirrors EventWizardPage.test.tsx's renderEditionDetailsStep — a brand-new (isNew) edition is the
// simplest way to mount the dialog, since it needs no EventEditionDto fixture and none of the
// Status MenuItems are conditionally disabled (that only happens `!isNew`, see EditionDialogInner's
// own Status Select above).
function renderEditionDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <BilingualLangProvider>
          <EditionDialogInner
            open
            edition={null}
            eventId="event-1"
            onClose={() => {}}
            onSaved={() => {}}
            onGalleryMutated={() => {}}
            onNotify={() => {}}
            siblingEditions={[]}
          />
        </BilingualLangProvider>
      </LocalizationProvider>
    </QueryClientProvider>,
  );
}

// Same [role="combobox"] disambiguation as EventWizardPage.test.tsx's getStatusCombobox/
// getRegistrationStatusCombobox — jsdom never fires the transitionend that would otherwise unmount
// a just-closed MUI Menu listbox, so one can linger in the DOM sharing the same aria-labelledby as
// its Select after chooseMenuOption below.
function getStatusCombobox() {
  return screen.getByLabelText('Status', { selector: '[role="combobox"]' });
}
function getRegistrationStatusCombobox() {
  return screen.getByLabelText('Registration status', { selector: '[role="combobox"]' });
}

function chooseMenuOption(combobox: HTMLElement, optionText: string) {
  fireEvent.mouseDown(combobox);
  const listbox = screen.getByRole('listbox');
  fireEvent.click(within(listbox).getByText(optionText));
}

describe('EditionDialogInner — Status/Registration status Selects are reachable via getByLabelText (#977)', () => {
  afterEach(cleanup);

  it('locates Status by label and changes it', () => {
    renderEditionDialog();

    expect(getStatusCombobox().textContent).toBe(EDITION_STATUS_LABELS.Hidden);

    chooseMenuOption(getStatusCombobox(), EDITION_STATUS_LABELS.Active);
    expect(getStatusCombobox().textContent).toBe(EDITION_STATUS_LABELS.Active);
  });

  it('locates Registration status by label and changes it', () => {
    renderEditionDialog();

    expect(getRegistrationStatusCombobox().textContent).toBe('NotStarted');

    chooseMenuOption(getRegistrationStatusCombobox(), 'Open');
    expect(getRegistrationStatusCombobox().textContent).toBe('Open');
  });
});
