import { addressFromListingUrl } from './houseListing';

describe('addressFromListingUrl', () => {
  it('reads the address out of common listing links', () => {
    expect(
      addressFromListingUrl(
        'https://www.realtor.ca/real-estate/27512345/12345-148-street-surrey-fraser-heights',
      ),
    ).toBe('12345 148 Street Surrey Fraser Heights');
    expect(
      addressFromListingUrl(
        'https://www.zillow.com/homedetails/123-Main-St-Austin-TX-78701/29384_zpid/',
      ),
    ).toBe('123 Main St Austin TX 78701');
  });

  it('gives up on links without one', () => {
    expect(addressFromListingUrl('not a url')).toBeNull();
    expect(
      addressFromListingUrl('https://example.com/listing/123456789'),
    ).toBeNull();
  });
});
